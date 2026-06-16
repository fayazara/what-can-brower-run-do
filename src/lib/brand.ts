import { env } from "cloudflare:workers"
import puppeteer from "@cloudflare/puppeteer"
import { sql } from "drizzle-orm"
import type { Browser, BrowserWorker } from "@cloudflare/puppeteer"
import { db } from "@/db"
import { brandPages } from "@/db/schema"
import { guardUrl } from "@/lib/url-guard"

/**
 * Brand extraction — the shared engine behind both `POST /api/brand` (the
 * interactive demo) and the `/brand/{domain}` shareable permalink pages.
 *
 * Why a real browser instead of the `json` quick action (AI)? An LLM only sees
 * the page's *text*, so it reliably gets the name/description yet hallucinates
 * exact hex colors, font-family names and the logo — those facts live in
 * CSS/computed styles, not readable text. Here we drive headless Chromium with
 * Puppeteer and read the REAL computed styles, meta tags and logo straight from
 * the DOM via `page.evaluate()`. `page.setBypassCSP(true)` lets the extractor
 * run even on strict-CSP sites (github.com, stripe.com, …).
 *
 * Results are cached in Workers KV keyed by the normalized URL (7 days), and a
 * lightweight row is upserted into the `brand_pages` D1 table so the public
 * directory of generated pages stays in sync without re-running the browser.
 *
 * This module imports `cloudflare:workers` and is SERVER-ONLY. Import it from
 * API route handlers and server functions only — never from a client bundle.
 */

const CACHE_TTL_SECONDS = 60 * 60 * 24 * 7 // 7 days
// Bump when the extraction shape changes so stale kits get re-generated.
const CACHE_VERSION = "v5"

export type BrandColor = { name?: string; hex: string }
export type BrandFont = { name: string; usage?: string }

/** Semantic page colors, read from the most-used computed styles. */
export type BrandSurface = {
  background?: string
  foreground?: string
  border?: string
  muted?: string
}

/** One step of a type scale (h1…h6, body, small), values from computed styles. */
export type TypeStyle = {
  name: string
  fontFamily?: string
  /** font-size in rem. */
  fontSize: string
  /** line-height as a unitless ratio when derivable. */
  lineHeight?: string
  fontWeight?: number
  /** letter-spacing (e.g. "-0.02em"), omitted when "normal". */
  letterSpacing?: string
}

export type RadiusToken = { name: string; value: string }
export type ShadowToken = { name: string; value: string }

/** Component tokens for the page's primary button. */
export type ButtonStyle = {
  background?: string
  color?: string
  borderRadius?: string
  paddingX?: string
  paddingY?: string
  fontSize?: string
  fontWeight?: number
}

export type BrandKit = {
  name?: string
  description?: string
  tagline?: string
  /** Best brandmark — an inline-SVG logo (as a data: URI), <img> logo, or icon. */
  logoUrl?: string
  /** Declared favicon / apple-touch-icon, for thumbnails. */
  icon?: string
  ogImage?: string
  /** "light" | "dark" — the page's predominant scheme. */
  colorScheme?: "light" | "dark"
  /** Chromatic brand colors (primary, secondary, accent, …). */
  colors?: Array<BrandColor>
  /** Semantic surface colors. */
  surface?: BrandSurface
  /** Type families (headings, body, mono). */
  fonts?: Array<BrandFont>
  /** Distinct font weights used for text. */
  fontWeights?: Array<number>
  /** The type scale read from real headings/body. */
  typeScale?: Array<TypeStyle>
  /** Border-radius scale (sm…full). */
  radii?: Array<RadiusToken>
  /** Box-shadow / elevation scale (sm…lg). */
  shadows?: Array<ShadowToken>
  /** The primary button's component tokens. */
  button?: ButtonStyle
}

/**
 * Runs in the page (headless Chromium) via `page.evaluate()`. Self-contained -
 * it must not reference anything outside its own scope. Reads real computed
 * styles + meta tags and returns the brand kit as a JSON string (a primitive,
 * which `page.evaluate` serializes reliably).
 */
const BRAND_SCRIPT = `
(() => {
  var origin = location.href;
  var abs = function (u) { try { return new URL(u, origin).href; } catch (e) { return u; } };
  var meta = function (sel) { var m = document.querySelector(sel); return m && m.content ? m.content.trim() : null; };
  var rootPx = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
  function pxNum(v) { var n = parseFloat(v); return isNaN(n) ? null : n; }
  function rem(v) { var n = pxNum(v); if (n == null) return null; return (Math.round((n / rootPx) * 1000) / 1000) + 'rem'; }

  function parseColor(str) {
    if (!str) return null;
    var m = str.match(/rgba?\\(([^)]+)\\)/);
    if (!m) return null;
    var p = m[1].split(',').map(function (x) { return parseFloat(x.trim()); });
    var a = p.length > 3 ? p[3] : 1;
    if (a === 0) return null;
    return { r: p[0], g: p[1], b: p[2] };
  }
  function toHex(c) {
    var h = function (n) { var s = Math.max(0, Math.min(255, Math.round(n))).toString(16); return s.length < 2 ? '0' + s : s; };
    return ('#' + h(c.r) + h(c.g) + h(c.b)).toUpperCase();
  }
  function saturation(c) {
    var r = c.r / 255, g = c.g / 255, b = c.b / 255;
    var max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2, d = max - min;
    if (d === 0) return 0;
    return l > 0.5 ? d / (2 - max - min) : d / (max + min);
  }
  function lightness(c) {
    var max = Math.max(c.r, c.g, c.b) / 255, min = Math.min(c.r, c.g, c.b) / 255;
    return (max + min) / 2;
  }
  function dist(a, b) {
    return Math.sqrt(Math.pow(a.r - b.r, 2) + Math.pow(a.g - b.g, 2) + Math.pow(a.b - b.b, 2));
  }
  function resolve(colorStr) {
    var d = document.createElement('div');
    d.style.color = colorStr;
    document.body.appendChild(d);
    var c = getComputedStyle(d).color;
    d.remove();
    return parseColor(c);
  }
  function cleanFont(ff) {
    if (!ff) return null;
    var generic = ['sans-serif', 'serif', 'monospace', 'system-ui', '-apple-system', 'ui-sans-serif', 'ui-serif', 'ui-monospace', 'blinkmacsystemfont', 'segoe ui', 'roboto', 'helvetica neue', 'arial'];
    var parts = ff.split(',').map(function (x) { return x.trim().replace(/^["']|["']$/g, ''); });
    for (var k = 0; k < parts.length; k++) { if (parts[k] && generic.indexOf(parts[k].toLowerCase()) < 0) return parts[k]; }
    return parts[0] || null;
  }

  // ---- colors + surface: a single pass over the DOM ----
  var scored = {};       // chromatic brand colors
  var textTally = {};    // text colors (for foreground / muted)
  var borderTally = {};  // visible border colors
  function add(c, weight) {
    var hex = toHex(c);
    if (!scored[hex]) scored[hex] = { score: 0, c: c };
    scored[hex].score += weight;
  }
  function bump(map, hex) { map[hex] = (map[hex] || 0) + 1; }

  var themeColor = meta('meta[name="theme-color"]');
  if (themeColor) { var tc = resolve(themeColor); if (tc) add(tc, 1000); }

  var all = document.querySelectorAll('body *');
  var limit = Math.min(all.length, 4000);
  for (var i = 0; i < limit; i++) {
    var el = all[i];
    var cs = getComputedStyle(el);
    var tag = el.tagName.toLowerCase();
    var cls = (el.className && el.className.toString ? el.className.toString() : '').toLowerCase();
    var emphasis = (tag === 'button' || tag === 'a' || /btn|cta|button|brand|logo|nav|header|primary|hero/.test(cls)) ? 3 : 1;
    var props = [cs.backgroundColor, cs.color, cs.borderColor];
    for (var j = 0; j < props.length; j++) {
      var col = parseColor(props[j]);
      if (!col) continue;
      if (saturation(col) < 0.2) continue;          // skip greys / near-white / near-black
      var lt = lightness(col);
      if (lt < 0.07 || lt > 0.95) continue;
      add(col, (j === 0 ? 2 : 1) * emphasis);        // backgrounds weigh more than text
    }
    var txt = parseColor(cs.color); if (txt) bump(textTally, toHex(txt));
    if ((parseFloat(cs.borderTopWidth) || 0) > 0) { var bc = parseColor(cs.borderTopColor); if (bc) bump(borderTally, toHex(bc)); }
  }

  var entries = Object.keys(scored).map(function (h) { return { hex: h, score: scored[h].score, c: scored[h].c }; });
  entries.sort(function (a, b) { return b.score - a.score; });
  var picked = [];
  for (var e = 0; e < entries.length && picked.length < 5; e++) {
    var ok = true;
    for (var p = 0; p < picked.length; p++) { if (dist(entries[e].c, picked[p].c) < 40) { ok = false; break; } }
    if (ok) picked.push(entries[e]);
  }
  var roles = ['primary', 'secondary', 'accent', 'color 4', 'color 5'];
  var colors = picked.map(function (c, idx) { return { name: roles[idx], hex: c.hex }; });

  function topKeys(map) {
    return Object.keys(map).sort(function (a, b) { return map[b] - map[a]; });
  }

  // ---- surface: background, foreground, border, muted ----
  function effectiveBg() {
    var node = document.body;
    while (node) { var c = parseColor(getComputedStyle(node).backgroundColor); if (c) return c; node = node.parentElement; }
    return null;
  }
  var bg = effectiveBg();
  var texts = topKeys(textTally);
  var borders = topKeys(borderTally);
  var surface = {
    background: bg ? toHex(bg) : null,
    foreground: texts[0] || null,
    muted: texts[1] || null,
    border: borders[0] || null
  };
  var colorScheme = 'light';
  var schemeDecl = (getComputedStyle(document.documentElement).colorScheme || '').toLowerCase();
  if (/dark/.test(schemeDecl) && !/light/.test(schemeDecl)) colorScheme = 'dark';
  else if (bg && lightness(bg) < 0.45) colorScheme = 'dark';

  // ---- fonts: heading / body / mono + weights ----
  var headingEl = document.querySelector('h1, h2, h3');
  var headingFont = headingEl ? cleanFont(getComputedStyle(headingEl).fontFamily) : null;
  var bodyFont = cleanFont(getComputedStyle(document.body).fontFamily);
  var monoEl = document.querySelector('code, pre, kbd');
  var monoFont = monoEl ? cleanFont(getComputedStyle(monoEl).fontFamily) : null;
  var fonts = [];
  if (headingFont) fonts.push({ name: headingFont, usage: 'headings' });
  if (bodyFont && bodyFont.toLowerCase() !== (headingFont || '').toLowerCase()) fonts.push({ name: bodyFont, usage: 'body' });
  if (monoFont && monoFont.toLowerCase() !== (bodyFont || '').toLowerCase() && monoFont.toLowerCase() !== (headingFont || '').toLowerCase()) fonts.push({ name: monoFont, usage: 'mono' });

  var weightSet = {};
  ['h1', 'h2', 'h3', 'p', 'strong', 'button', 'a'].forEach(function (sel) {
    var el = document.querySelector(sel);
    if (el) { var w = parseInt(getComputedStyle(el).fontWeight); if (w) weightSet[w] = 1; }
  });
  var fontWeights = Object.keys(weightSet).map(Number).sort(function (a, b) { return a - b; });

  // ---- type scale: real sizes from headings + body ----
  function typeStyle(name, sel) {
    var el = document.querySelector(sel);
    if (!el) return null;
    var s = getComputedStyle(el);
    var fs = rem(s.fontSize);
    if (!fs) return null;
    var lhOut = null;
    if (s.lineHeight && s.lineHeight !== 'normal') {
      var lhn = pxNum(s.lineHeight), fsn = pxNum(s.fontSize);
      if (lhn != null && fsn) lhOut = '' + (Math.round((lhn / fsn) * 100) / 100);
    }
    var ls = (s.letterSpacing && s.letterSpacing !== 'normal') ? s.letterSpacing : null;
    var st = { name: name, fontSize: fs, fontWeight: parseInt(s.fontWeight) || null, fontFamily: cleanFont(s.fontFamily) };
    if (lhOut) st.lineHeight = lhOut;
    if (ls) st.letterSpacing = ls;
    return st;
  }
  var typeScale = [];
  [['h1', 'h1'], ['h2', 'h2'], ['h3', 'h3'], ['h4', 'h4'], ['body', 'p'], ['small', 'small, figcaption']].forEach(function (t) {
    var st = typeStyle(t[0], t[1]); if (st) typeScale.push(st);
  });

  // ---- radii: from buttons / inputs / cards ----
  var radiiSet = {};
  var rSel = document.querySelectorAll('button, a[class*="btn" i], a[class*="button" i], input, [class*="card" i], [class*="rounded" i], dialog');
  for (var r = 0; r < Math.min(rSel.length, 500); r++) {
    var br = (getComputedStyle(rSel[r]).borderRadius || '').split(' ')[0];
    if (!br) continue;
    if (br.indexOf('%') >= 0) { radiiSet['full'] = '9999px'; continue; }
    var bn = pxNum(br); if (bn == null || bn <= 0) continue;
    if (bn >= 9999) { radiiSet['full'] = '9999px'; continue; }
    radiiSet[bn] = Math.round(bn) + 'px';
  }
  var radiusNums = Object.keys(radiiSet).filter(function (k) { return k !== 'full'; }).map(Number).sort(function (a, b) { return a - b; });
  var rNames = ['sm', 'md', 'lg', 'xl', '2xl'];
  var radii = radiusNums.slice(0, 5).map(function (n, i) { return { name: rNames[i] || ('r' + i), value: Math.round(n) + 'px' }; });
  if (radiiSet['full']) radii.push({ name: 'full', value: '9999px' });

  // ---- shadows: elevation scale ----
  var shadowSet = {};
  var sSel = document.querySelectorAll('[class*="card" i], [class*="shadow" i], button, dialog, [class*="modal" i], header, nav');
  for (var sh = 0; sh < Math.min(sSel.length, 500); sh++) {
    var bsh = getComputedStyle(sSel[sh]).boxShadow;
    if (bsh && bsh !== 'none') bump(shadowSet, bsh);
  }
  function blurOf(s) { var m = s.match(/-?\\d+(?:\\.\\d+)?px/g); return (m && m[2]) ? Math.abs(parseFloat(m[2])) : 0; }
  var shadowArr = Object.keys(shadowSet).sort(function (a, b) { return blurOf(a) - blurOf(b); });
  var shPicks = [];
  if (shadowArr.length) {
    shPicks.push(shadowArr[0]);
    if (shadowArr.length > 2) shPicks.push(shadowArr[Math.floor(shadowArr.length / 2)]);
    if (shadowArr.length > 1) shPicks.push(shadowArr[shadowArr.length - 1]);
  }
  var shNames = ['sm', 'md', 'lg'];
  var seenSh = {}, shadows = [], spi = 0;
  shPicks.forEach(function (v) { if (seenSh[v]) return; seenSh[v] = 1; shadows.push({ name: shNames[spi] || ('e' + spi), value: v }); spi++; });

  // ---- button: the page's primary action ----
  function findButton() {
    var cand = document.querySelectorAll('a[class*="btn" i], a[class*="button" i], button, [role="button"], [class*="cta" i]');
    var best = null, bestScore = -1;
    for (var i2 = 0; i2 < Math.min(cand.length, 200); i2++) {
      var b = cand[i2], s = getComputedStyle(b), bgc = parseColor(s.backgroundColor);
      if (!bgc) continue;
      if (lightness(bgc) > 0.97) continue;          // skip ghost / white buttons
      var rect = b.getBoundingClientRect();
      if (rect.width < 40 || rect.height < 20) continue;
      var score = saturation(bgc) * 2 + (rect.top < 1000 ? 1 : 0);
      if (score > bestScore) { bestScore = score; best = { s: s, bg: bgc }; }
    }
    if (!best) return null;
    var s = best.s, tcol = parseColor(s.color);
    return {
      background: toHex(best.bg),
      color: tcol ? toHex(tcol) : null,
      borderRadius: (s.borderRadius || '').split(' ')[0] || null,
      paddingX: s.paddingLeft || null,
      paddingY: s.paddingTop || null,
      fontSize: rem(s.fontSize),
      fontWeight: parseInt(s.fontWeight) || null
    };
  }
  var button = findButton();

  // ---- logo: inline SVG (as data URI) → <img> logo → JSON-LD → icons. ----
  function serializeSvg(svg) {
    try {
      var clone = svg.cloneNode(true);
      if (!clone.getAttribute('xmlns')) clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
      var str = new XMLSerializer().serializeToString(clone);
      if (str.length > 30000) return null;
      return 'data:image/svg+xml,' + encodeURIComponent(str);
    } catch (e) { return null; }
  }
  function jsonLdLogo() {
    var scripts = document.querySelectorAll('script[type="application/ld+json"]');
    for (var i3 = 0; i3 < scripts.length; i3++) {
      try {
        var parsed = JSON.parse(scripts[i3].textContent);
        var arr = Array.isArray(parsed) ? parsed : (parsed['@graph'] ? parsed['@graph'] : [parsed]);
        for (var k3 = 0; k3 < arr.length; k3++) {
          var o = arr[k3]; if (!o) continue;
          var lg = o.logo || (o.publisher && o.publisher.logo);
          if (lg) { if (typeof lg === 'string') return abs(lg); if (lg.url) return abs(lg.url); }
        }
      } catch (e) {}
    }
    return null;
  }
  function pickIcon() {
    var apple = document.querySelector('link[rel="apple-touch-icon"], link[rel="apple-touch-icon-precomposed"]');
    if (apple && apple.href) return abs(apple.href);
    var icons = Array.prototype.slice.call(document.querySelectorAll('link[rel~="icon"]'));
    icons.sort(function (a, b) {
      var sa = parseInt((a.getAttribute('sizes') || '0').split('x')[0]) || 0;
      var sb = parseInt((b.getAttribute('sizes') || '0').split('x')[0]) || 0;
      return sb - sa;
    });
    if (icons.length && icons[0].href) return abs(icons[0].href);
    var mask = document.querySelector('link[rel="mask-icon"]'); if (mask && mask.href) return abs(mask.href);
    var tile = meta('meta[name="msapplication-TileImage"]'); if (tile) return abs(tile);
    return null;
  }
  function pickLogo() {
    var svgSels = ['a[href="/"] svg', 'header a[href="/"] svg', '[class*="logo" i] svg', 'header svg', 'nav svg'];
    for (var s2 = 0; s2 < svgSels.length; s2++) {
      var svg = document.querySelector(svgSels[s2]);
      if (svg) {
        var rc = svg.getBoundingClientRect();
        if (rc.width >= 16 && rc.width <= 640 && rc.height >= 8) { var d = serializeSvg(svg); if (d) return d; }
      }
    }
    var imgSels = ['header [class*="logo" i] img', '[class*="logo" i] img', 'img[alt*="logo" i]', 'header a[href="/"] img', 'a[href="/"] img', '[id*="logo" i] img', 'header img'];
    for (var i4 = 0; i4 < imgSels.length; i4++) {
      var img = document.querySelector(imgSels[i4]);
      if (img) { var src = img.currentSrc || img.getAttribute('src'); if (src) return abs(src); }
    }
    var ld = jsonLdLogo(); if (ld) return ld;
    return null;
  }
  var icon = pickIcon();
  var logoUrl = pickLogo() || icon || '';

  var name = meta('meta[property="og:site_name"]') ||
    (document.title ? document.title.split(/[-|–—·•:]/)[0].trim() : '') ||
    location.hostname.replace(/^www\\./, '');
  var description = meta('meta[name="description"]') || meta('meta[property="og:description"]') || '';
  var h1 = document.querySelector('h1');
  var tagline = h1 && h1.innerText ? h1.innerText.trim().replace(/\\s+/g, ' ').slice(0, 140) : '';

  var ogImage = meta('meta[property="og:image"]') || meta('meta[property="og:image:url"]') || meta('meta[name="twitter:image"]') || meta('meta[name="twitter:image:src"]');
  ogImage = ogImage ? abs(ogImage) : '';

  var data = {
    name: name, description: description, tagline: tagline,
    logoUrl: logoUrl, icon: icon || '', ogImage: ogImage,
    colorScheme: colorScheme, colors: colors, surface: surface,
    fonts: fonts, fontWeights: fontWeights, typeScale: typeScale,
    radii: radii, shadows: shadows, button: button
  };
  return JSON.stringify(data);
})();
`

/**
 * Fallback for pages whose Content-Security-Policy blocks the injected
 * `addScriptTag` script (e.g. github.com, stripe.com). Parses the rendered HTML
 * on the server for everything obtainable from markup alone: name, description,
 * tagline, og:image, a logo, and a theme-color swatch. Computed-style colors
 * and fonts aren't available without running in the page.
 */
function parseStaticBrand(html: string, pageUrl: string): BrandKit {
  // Attribute values in raw HTML are entity-encoded (e.g. `&amp;` in a URL's
  // query string). Decode the common ones so URLs and text come out clean.
  const decode = (s: string): string =>
    s
      .replace(/&amp;/g, "&")
      .replace(/&quot;/g, '"')
      .replace(/&#0?39;/g, "'")
      .replace(/&#x27;/gi, "'")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&nbsp;/g, " ")
  const abs = (u: string): string => {
    try {
      return new URL(decode(u), pageUrl).href
    } catch {
      return decode(u)
    }
  }
  const meta = (key: string): string => {
    const variants = [
      new RegExp(
        `<meta[^>]+(?:property|name)=["']${key}["'][^>]*content=["']([^"']*)["']`,
        "i",
      ),
      new RegExp(
        `<meta[^>]+content=["']([^"']*)["'][^>]*(?:property|name)=["']${key}["']`,
        "i",
      ),
    ]
    for (const re of variants) {
      const m = html.match(re)
      if (m?.[1]) return decode(m[1].trim())
    }
    return ""
  }
  const linkHref = (relMatch: RegExp): string => {
    const tags = html.match(/<link\b[^>]*>/gi) ?? []
    for (const tag of tags) {
      const rel = tag.match(/rel=["']([^"']*)["']/i)?.[1] ?? ""
      if (relMatch.test(rel)) {
        const href = tag.match(/href=["']([^"']*)["']/i)?.[1]
        if (href) return abs(href)
      }
    }
    return ""
  }

  const host = (() => {
    try {
      return new URL(pageUrl).hostname.replace(/^www\./, "")
    } catch {
      return pageUrl
    }
  })()

  // JSON-LD organisation/publisher logo, if present.
  const jsonLdLogo = (): string => {
    const blocks =
      html.match(
        /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
      ) ?? []
    for (const block of blocks) {
      const body = block.replace(/^[\s\S]*?>/, "").replace(/<\/script>$/i, "")
      const m = body.match(/"logo"\s*:\s*("([^"]+)"|\{[^}]*"url"\s*:\s*"([^"]+)")/i)
      const url = m?.[2] ?? m?.[3]
      if (url) return abs(url)
    }
    return ""
  }

  const titleRaw = html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1] ?? ""
  const title = decode(titleRaw).split(/[-|–—·•:]/)[0].trim()

  const name = meta("og:site_name") || title || host
  const description = meta("description") || meta("og:description") || ""
  const ogImage =
    meta("og:image") ||
    meta("og:image:url") ||
    meta("twitter:image") ||
    meta("twitter:image:src") ||
    ""
  // Declared icons only — no blind /favicon.ico guess (often 404s).
  const icon =
    linkHref(/apple-touch-icon/i) ||
    linkHref(/(^|\s)icon(\s|$)|shortcut/i) ||
    linkHref(/mask-icon/i) ||
    ""
  const logoUrl = jsonLdLogo() || icon

  const colors: Array<BrandColor> = []
  const themeColor = meta("theme-color")
  const hex = themeColor.match(/^#?([0-9a-f]{6}|[0-9a-f]{3})$/i)
  if (hex) {
    const h = hex[1]
    const full =
      h.length === 3
        ? h
            .split("")
            .map((c) => c + c)
            .join("")
        : h
    colors.push({ name: "primary", hex: `#${full.toUpperCase()}` })
  }

  return {
    name,
    description,
    tagline: "",
    logoUrl,
    icon,
    ogImage: ogImage ? abs(ogImage) : "",
    colorScheme: "light",
    colors,
    surface: {},
    fonts: [],
    fontWeights: [],
    typeScale: [],
    radii: [],
    shadows: [],
  }
}

/** Normalize a URL into a stable cache key. */
function cacheKeyFor(rawUrl: string): string {
  const u = new URL(rawUrl)
  const host = u.host.toLowerCase()
  const path = u.pathname.replace(/\/+$/, "")
  return `brand:${CACHE_VERSION}:${host}${path}${u.search}`
}

/**
 * Reuse an idle browser session if one is free, otherwise launch a new one.
 * This avoids cold-start time and helps stay within concurrent-session limits
 * under load. Callers MUST `disconnect()` (not `close()`) when done so the
 * session can be picked up by the next request.
 */
async function acquireBrowser(endpoint: BrowserWorker): Promise<Browser> {
  try {
    const sessions = await puppeteer.sessions(endpoint)
    const free = sessions
      .filter((s) => !s.connectionId)
      .map((s) => s.sessionId)
    if (free.length > 0) {
      const id = free[Math.floor(Math.random() * free.length)]
      try {
        return await puppeteer.connect(endpoint, id)
      } catch {
        // Another worker may have grabbed it first - fall through to launch.
      }
    }
  } catch {
    // sessions() can fail transiently; just launch a fresh browser.
  }
  return puppeteer.launch(endpoint)
}

/** True if the extractor returned something worth caching. */
function hasBrandData(b: BrandKit | null): b is BrandKit {
  return Boolean(
    b &&
      (b.name ||
        b.description ||
        b.ogImage ||
        (b.colors && b.colors.length) ||
        (b.fonts && b.fonts.length)),
  )
}

/** Bare, lowercased host for a URL — the canonical directory/permalink key. */
export function hostFor(rawUrl: string): string {
  try {
    return new URL(rawUrl).hostname.replace(/^www\./, "").toLowerCase()
  } catch {
    return rawUrl.toLowerCase()
  }
}

/**
 * Upsert the lightweight directory row for a generated brand page. Keyed by
 * host; bumps `hit_count` and `updated_at` on repeat generations. Best-effort:
 * a directory write must never fail the actual extraction, so errors are
 * swallowed.
 */
async function recordBrandPage(rawUrl: string, brand: BrandKit): Promise<void> {
  try {
    const domain = hostFor(rawUrl)
    // Prefer a small HTTP thumbnail for the directory; only fall back to an
    // inline-SVG data URI when that's the only mark we have.
    const httpLogo = brand.logoUrl?.startsWith("http") ? brand.logoUrl : null
    const thumb = brand.icon || httpLogo || brand.logoUrl || null
    await db
      .insert(brandPages)
      .values({ domain, name: brand.name ?? null, logoUrl: thumb })
      .onConflictDoUpdate({
        target: brandPages.domain,
        set: {
          name: brand.name ?? null,
          logoUrl: thumb,
          hitCount: sql`${brandPages.hitCount} + 1`,
          updatedAt: sql`(unixepoch())`,
        },
      })
  } catch {
    /* directory write is best-effort */
  }
}

export type ExtractResult = {
  url: string
  brand: BrandKit
  cached: boolean
}

/**
 * The full extraction pipeline used by both the API route and the permalink
 * pages: guard the URL → KV cache (unless `refresh`) → drive a headless browser
 * → cache + record in the directory. Throws on guard failure (with `.status`)
 * or unrecoverable browser errors.
 */
export async function extractBrand(
  rawUrl: string,
  opts: { refresh?: boolean } = {},
): Promise<ExtractResult> {
  const guard = await guardUrl(rawUrl)
  if (!guard.ok) {
    const err = new Error(guard.reason) as Error & { status?: number }
    err.status = guard.status
    throw err
  }
  const url = guard.url
  const refresh = opts.refresh ?? false
  const key = cacheKeyFor(url)

  // 1. Cache hit → return instantly (still record the visit in the directory).
  if (!refresh) {
    const cached = await env.CACHE.get<BrandKit>(key, "json")
    if (cached) {
      await recordBrandPage(url, cached)
      return { url, brand: cached, cached: true }
    }
  }

  // 2. Cache miss → drive a real headless browser. setBypassCSP lets the
  //    in-page extractor run even on CSP-locked sites (github, stripe).
  const endpoint = env.BROWSER as unknown as BrowserWorker
  let instance: Browser | undefined
  try {
    instance = await acquireBrowser(endpoint)
    const page = await instance.newPage()

    let brand: BrandKit | null = null
    try {
      await page.setBypassCSP(true)
      await page.goto(url, { waitUntil: "networkidle2", timeout: 30000 })

      // Preferred path: read computed styles + meta straight from the DOM.
      try {
        const raw = (await page.evaluate(BRAND_SCRIPT)) as string
        brand = JSON.parse(raw) as BrandKit
      } catch {
        brand = null
      }

      // Last-resort fallback: parse the rendered HTML on the server.
      if (!hasBrandData(brand)) {
        const html = await page.content()
        brand = parseStaticBrand(html, url)
      }
    } finally {
      await page.close().catch(() => {})
    }

    // 3. Cache for next time + index in the public directory.
    await env.CACHE.put(key, JSON.stringify(brand), {
      expirationTtl: CACHE_TTL_SECONDS,
    })
    await recordBrandPage(url, brand)

    return { url, brand, cached: false }
  } finally {
    // Free the session for reuse (do NOT close - keeps it warm).
    instance?.disconnect()
  }
}
