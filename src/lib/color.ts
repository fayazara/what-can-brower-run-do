/**
 * Pure color utilities — hex/RGB/HSL conversion plus a Tailwind-style tonal
 * scale generator (50…950) à la uicolors.app. Used by both the DESIGN.md
 * generator and the brand UI, so it must stay free of any server imports.
 */

export type Rgb = { r: number; g: number; b: number }
export type Hsl = { h: number; s: number; l: number }

export function hexToRgb(hex: string): Rgb | null {
  const m = hex
    .trim()
    .replace(/^#/, "")
    .match(/^([0-9a-f]{3}|[0-9a-f]{6})$/i)
  if (!m) return null
  let h = m[1]
  if (h.length === 3)
    h = h
      .split("")
      .map((c) => c + c)
      .join("")
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  }
}

export function rgbToHex({ r, g, b }: Rgb): string {
  const h = (n: number) =>
    Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, "0")
  return `#${h(r)}${h(g)}${h(b)}`.toUpperCase()
}

export function rgbToHsl({ r, g, b }: Rgb): Hsl {
  const rn = r / 255
  const gn = g / 255
  const bn = b / 255
  const max = Math.max(rn, gn, bn)
  const min = Math.min(rn, gn, bn)
  const d = max - min
  const l = (max + min) / 2
  let h = 0
  let s = 0
  if (d !== 0) {
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    switch (max) {
      case rn:
        h = ((gn - bn) / d + (gn < bn ? 6 : 0)) / 6
        break
      case gn:
        h = ((bn - rn) / d + 2) / 6
        break
      default:
        h = ((rn - gn) / d + 4) / 6
    }
  }
  return { h: h * 360, s, l }
}

export function hslToRgb({ h, s, l }: Hsl): Rgb {
  const hn = h / 360
  if (s === 0) {
    const v = l * 255
    return { r: v, g: v, b: v }
  }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s
  const p = 2 * l - q
  const hue = (t: number) => {
    let tt = t
    if (tt < 0) tt += 1
    if (tt > 1) tt -= 1
    if (tt < 1 / 6) return p + (q - p) * 6 * tt
    if (tt < 1 / 2) return q
    if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6
    return p
  }
  return {
    r: hue(hn + 1 / 3) * 255,
    g: hue(hn) * 255,
    b: hue(hn - 1 / 3) * 255,
  }
}

/** WCAG relative luminance (0…1) for picking readable label colors. */
export function relativeLuminance({ r, g, b }: Rgb): number {
  const f = (c: number) => {
    const cs = c / 255
    return cs <= 0.03928 ? cs / 12.92 : Math.pow((cs + 0.055) / 1.055, 2.4)
  }
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)
}

/** Black or white text that reads on the given background hex. */
export function readableTextColor(hex: string): "#000000" | "#FFFFFF" {
  const rgb = hexToRgb(hex)
  if (!rgb) return "#000000"
  return relativeLuminance(rgb) > 0.45 ? "#000000" : "#FFFFFF"
}

export type Shade = { stop: number; hex: string }
export type ColorScale = {
  /** The original brand color this scale was generated from. */
  base: string
  /** The stop (e.g. 600) whose slot holds the exact base color. */
  baseStop: number
  shades: Array<Shade>
}

const STOPS = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950]
// Target lightness per stop — tuned to feel like Tailwind's default palette.
const TARGET_L = [
  0.97, 0.938, 0.86, 0.77, 0.66, 0.55, 0.46, 0.38, 0.3, 0.23, 0.15,
]

/**
 * Generate a 50…950 tonal scale from a single brand color. Hue is preserved;
 * lightness follows fixed targets; saturation is gently eased at the extremes
 * so the lightest tints don't look neon and the darkest don't go muddy. The
 * exact input color is slotted into whichever stop it's closest to in lightness
 * (so the brand color always appears verbatim in its own scale).
 */
export function generateScale(hex: string): ColorScale | null {
  const rgb = hexToRgb(hex)
  if (!rgb) return null
  const base = rgbToHsl(rgb)

  let baseStop = 500
  let bestDelta = Infinity
  STOPS.forEach((stop, i) => {
    const delta = Math.abs(TARGET_L[i] - base.l)
    if (delta < bestDelta) {
      bestDelta = delta
      baseStop = stop
    }
  })

  const shades: Array<Shade> = STOPS.map((stop, i) => {
    if (stop === baseStop) return { stop, hex: rgbToHex(rgb).toUpperCase() }
    const l = TARGET_L[i]
    // Ease saturation down for the very light tints and deep shades.
    const ease = l > 0.85 ? 0.85 : l < 0.2 ? 0.92 : 1
    const s = Math.min(1, base.s * ease)
    return { stop, hex: rgbToHex(hslToRgb({ h: base.h, s, l })).toUpperCase() }
  })

  return { base: rgbToHex(rgb).toUpperCase(), baseStop, shades }
}
