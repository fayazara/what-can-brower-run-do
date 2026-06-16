import { env } from "cloudflare:workers"
import { guardUrl } from "@/lib/url-guard"

/**
 * Sitemap → tree extraction. No browser needed: we discover the sitemap from
 * robots.txt (falling back to the well-known paths), follow sitemap-index files
 * and gzipped sitemaps, then fold every `<loc>` into a shallow, capped tree of
 * path segments that the Kumo Flow diagram renders.
 *
 * Safety: only same-host sitemaps are fetched (SSRF hygiene), and everything is
 * bounded — number of sitemaps fetched, URLs considered, tree breadth and
 * depth — so a 50k-URL sitemap can't blow up the worker or the diagram.
 *
 * Results are cached in Workers KV. Server-only (`cloudflare:workers`).
 */

const CACHE_VERSION = "v1"
const CACHE_TTL_OK = 60 * 60 * 24 // 1 day for a real result
const CACHE_TTL_EMPTY = 60 * 60 // 1 hour for "no sitemap found"

const MAX_FETCH_SITEMAPS = 6 // total sitemap documents to download
const MAX_INDEX_CHILDREN = 50 // child sitemaps to queue from an index
const MAX_URLS = 2000 // URLs to fold into the tree
const MAX_SECTIONS = 12 // top-level branches
const MAX_CHILDREN = 8 // children per branch
const MAX_DEPTH = 2 // path-segment depth to build
const LABEL_MAX = 28

export type SitemapNode = {
  label: string
  path: string
  children?: Array<SitemapNode>
  /** Count of sibling children hidden by the cap, rendered as "+N more". */
  more?: number
}

export type SitemapTree = {
  /** The sitemap URL the tree was built from, if any. */
  source: string | null
  /** Total distinct URLs considered (post-cap). */
  total: number
  tree: SitemapNode | null
}

function decodeXml(s: string): string {
  return s
    .replace(/<!\[CDATA\[/g, "")
    .replace(/\]\]>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&#x27;/gi, "'")
    .trim()
}

async function fetchText(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: {
        "user-agent":
          "Mozilla/5.0 (compatible; BrowserRunBot/1.0; +https://workers.cloudflare.com)",
        accept: "text/xml,application/xml,text/plain,*/*",
      },
      redirect: "follow",
    })
    if (!res.ok || !res.body) return null
    // `.gz` sitemaps arrive as raw gzip bytes (no content-encoding), so the
    // runtime won't auto-inflate them — do it ourselves.
    if (/\.gz($|\?)/i.test(url)) {
      const ds = new DecompressionStream("gzip")
      return await new Response(res.body.pipeThrough(ds)).text()
    }
    return await res.text()
  } catch {
    return null
  }
}

async function discoverSitemaps(origin: string): Promise<Array<string>> {
  const robots = await fetchText(`${origin}/robots.txt`)
  const found: Array<string> = []
  if (robots) {
    const re = /^\s*sitemap:\s*(\S+)/gim
    let m: RegExpExecArray | null
    while ((m = re.exec(robots))) found.push(m[1].trim())
  }
  if (found.length === 0) {
    found.push(
      `${origin}/sitemap.xml`,
      `${origin}/sitemap_index.xml`,
      `${origin}/sitemap-index.xml`,
    )
  }
  return found
}

function extractLocs(xml: string): Array<string> {
  const locs: Array<string> = []
  const re = /<loc>([\s\S]*?)<\/loc>/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(xml))) {
    const v = decodeXml(m[1])
    if (v) locs.push(v)
  }
  return locs
}

function sameHost(url: string, host: string): boolean {
  try {
    return (
      new URL(url).hostname.replace(/^www\./, "").toLowerCase() === host
    )
  } catch {
    return false
  }
}

function truncate(s: string): string {
  return s.length > LABEL_MAX ? `${s.slice(0, LABEL_MAX - 1)}…` : s
}

type RawNode = {
  label: string
  path: string
  children: Map<string, RawNode>
  count: number
}

function buildTree(host: string, urls: Array<string>): SitemapNode {
  const root: RawNode = {
    label: host,
    path: "/",
    children: new Map(),
    count: 0,
  }

  for (const u of urls) {
    let pathname: string
    try {
      pathname = new URL(u).pathname
    } catch {
      continue
    }
    const segs = pathname.split("/").filter(Boolean)
    let node = root
    let acc = ""
    for (let d = 0; d < segs.length && d < MAX_DEPTH; d++) {
      const seg = decodeURIComponent(segs[d])
      acc += `/${seg}`
      let child = node.children.get(seg)
      if (!child) {
        child = {
          label: truncate(`/${seg}`),
          path: acc,
          children: new Map(),
          count: 0,
        }
        node.children.set(seg, child)
      }
      child.count++
      node = child
    }
  }

  const convert = (n: RawNode, depth: number): SitemapNode => {
    const kids = Array.from(n.children.values()).sort(
      (a, b) => b.count - a.count,
    )
    const cap = depth === 0 ? MAX_SECTIONS : MAX_CHILDREN
    const shown = kids.slice(0, cap)
    const node: SitemapNode = { label: n.label, path: n.path }
    if (shown.length > 0)
      node.children = shown.map((k) => convert(k, depth + 1))
    const hidden = kids.length - shown.length
    if (hidden > 0) node.more = hidden
    return node
  }

  return convert(root, 0)
}

export async function getSitemap(host: string): Promise<SitemapTree> {
  const origin = `https://${host}`
  const guard = await guardUrl(origin)
  if (!guard.ok) return { source: null, total: 0, tree: null }

  const key = `sitemap:${CACHE_VERSION}:${host}`
  const cached = await env.CACHE.get<SitemapTree>(key, "json")
  if (cached) return cached

  const queue = await discoverSitemaps(origin)
  const seen = new Set<string>()
  const urlSet = new Set<string>()
  let source: string | null = null
  let fetched = 0

  while (queue.length > 0 && fetched < MAX_FETCH_SITEMAPS && urlSet.size < MAX_URLS) {
    const sm = queue.shift() as string
    if (seen.has(sm)) continue
    seen.add(sm)
    if (!sameHost(sm, host)) continue

    const xml = await fetchText(sm)
    if (!xml) continue
    fetched++

    if (/<sitemapindex/i.test(xml)) {
      for (const child of extractLocs(xml)) {
        if (queue.length < MAX_INDEX_CHILDREN) queue.push(child)
      }
      continue
    }

    const locs = extractLocs(xml)
    if (locs.length > 0) {
      if (!source) source = sm
      for (const u of locs) {
        if (urlSet.size >= MAX_URLS) break
        urlSet.add(u)
      }
    }
  }

  if (urlSet.size === 0) {
    const empty: SitemapTree = { source: null, total: 0, tree: null }
    await env.CACHE.put(key, JSON.stringify(empty), {
      expirationTtl: CACHE_TTL_EMPTY,
    })
    return empty
  }

  const result: SitemapTree = {
    source,
    total: urlSet.size,
    tree: buildTree(host, Array.from(urlSet)),
  }
  await env.CACHE.put(key, JSON.stringify(result), {
    expirationTtl: CACHE_TTL_OK,
  })
  return result
}
