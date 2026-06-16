import type { BrandFont, BrandKit } from "@/lib/brand"
import { generateScale } from "@/lib/color"

/**
 * Convert an extracted {@link BrandKit} into a Google `DESIGN.md` document —
 * the format coding agents read to get a "persistent, structured understanding
 * of a design system" (https://github.com/google-labs-code/design.md).
 *
 * A DESIGN.md has two layers:
 *   1. YAML front matter — machine-readable design tokens (colors with full
 *      50…950 tonal scales, typography, rounded, components).
 *   2. Markdown body     — human-readable rationale in the spec's section order
 *      (Overview → Colors → Typography → Elevation → Shapes → Components).
 *
 * Pure function (type-only import of BrandKit) — safe on server and client.
 */

/** Brand color roles that get a full generated tonal scale. */
const SCALED_ROLES = new Set(["primary", "secondary", "accent"])

/** Quote a scalar for YAML when it could be ambiguous; otherwise leave bare. */
function yamlScalar(value: string): string {
  const v = value.trim()
  if (v === "") return '""'
  if (/[:#\-?,[\]{}&*!|>'"%@`]|^\s|\s$|^\d/.test(v) || /[\n\r]/.test(v)) {
    return `"${v.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`
  }
  return v
}

/** YAML token key from a human role like "color 4" → "color-4". */
function tokenKey(name: string | undefined, fallbackIndex: number): string {
  const base = (name ?? `color ${fallbackIndex + 1}`)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
  return base || `color-${fallbackIndex + 1}`
}

/** Map a type-scale step name to a DESIGN.md typography token name. */
function typeTokenName(name: string): string {
  if (name === "body") return "body-md"
  if (name === "small") return "label-sm"
  return name
}

type DesignMdOptions = {
  domain: string
  sourceUrl?: string
}

export function toDesignMd(brand: BrandKit, opts: DesignMdOptions): string {
  const name = brand.name?.trim() || opts.domain
  const colors = brand.colors ?? []
  const surface = brand.surface ?? {}
  const fonts = brand.fonts ?? []
  const typeScale = brand.typeScale ?? []
  const radii = brand.radii ?? []
  const shadows = brand.shadows ?? []
  const button = brand.button

  const headingFont = fonts.find((f) => f.usage === "headings")
  const bodyFont = fonts.find((f) => f.usage === "body")
  const monoFont = fonts.find((f) => f.usage === "mono")

  // Pre-compute tonal scales for the primary/secondary/accent colors.
  const scaleByKey = new Map<string, ReturnType<typeof generateScale>>()
  colors.forEach((c, i) => {
    const key = tokenKey(c.name, i)
    if (SCALED_ROLES.has(key)) scaleByKey.set(key, generateScale(c.hex))
  })

  // ---------- YAML front matter ----------
  const fm: Array<string> = ["---"]
  fm.push(`name: ${yamlScalar(name)}`)
  if (brand.description?.trim())
    fm.push(`description: ${yamlScalar(brand.description)}`)
  if (brand.colorScheme) fm.push(`colorScheme: ${brand.colorScheme}`)

  // colors: semantic surface tokens, then brand colors + their scales.
  const colorLines: Array<string> = []
  if (surface.background)
    colorLines.push(`  background: ${yamlScalar(surface.background)}`)
  if (surface.foreground)
    colorLines.push(`  foreground: ${yamlScalar(surface.foreground)}`)
  if (surface.muted) colorLines.push(`  muted: ${yamlScalar(surface.muted)}`)
  if (surface.border) colorLines.push(`  border: ${yamlScalar(surface.border)}`)

  const usedKeys = new Set<string>()
  colors.forEach((c, i) => {
    let key = tokenKey(c.name, i)
    while (usedKeys.has(key)) key = `${key}-${i}`
    usedKeys.add(key)
    colorLines.push(`  ${key}: ${yamlScalar(c.hex)}`)
    const scale = scaleByKey.get(key)
    if (scale) {
      for (const shade of scale.shades) {
        colorLines.push(`  ${key}-${shade.stop}: ${yamlScalar(shade.hex)}`)
      }
    }
  })
  if (colorLines.length > 0) {
    fm.push("colors:")
    fm.push(...colorLines)
  }

  // typography: one token per type-scale step.
  if (typeScale.length > 0) {
    fm.push("typography:")
    for (const t of typeScale) {
      fm.push(`  ${typeTokenName(t.name)}:`)
      const family = t.fontFamily ?? headingFont?.name ?? bodyFont?.name
      if (family) fm.push(`    fontFamily: ${yamlScalar(family)}`)
      fm.push(`    fontSize: ${yamlScalar(t.fontSize)}`)
      if (t.fontWeight) fm.push(`    fontWeight: ${t.fontWeight}`)
      if (t.lineHeight) fm.push(`    lineHeight: ${yamlScalar(t.lineHeight)}`)
      if (t.letterSpacing)
        fm.push(`    letterSpacing: ${yamlScalar(t.letterSpacing)}`)
    }
  }

  // rounded scale.
  if (radii.length > 0) {
    fm.push("rounded:")
    for (const r of radii) fm.push(`  ${r.name}: ${yamlScalar(r.value)}`)
  }

  // components: the primary button.
  if (button?.background) {
    const primaryHex = colors[0]?.hex?.toUpperCase()
    const bgRef =
      primaryHex && button.background.toUpperCase() === primaryHex
        ? "{colors.primary}"
        : button.background
    fm.push("components:")
    fm.push("  button-primary:")
    fm.push(`    backgroundColor: ${yamlScalar(bgRef)}`)
    if (button.color) fm.push(`    textColor: ${yamlScalar(button.color)}`)
    if (button.borderRadius)
      fm.push(`    rounded: ${yamlScalar(button.borderRadius)}`)
    if (button.paddingY && button.paddingX)
      fm.push(
        `    padding: ${yamlScalar(`${button.paddingY} ${button.paddingX}`)}`,
      )
  }
  fm.push("---")

  // ---------- Markdown body ----------
  const body: Array<string> = [`# ${name}`]

  // Overview
  const overview: Array<string> = []
  if (brand.tagline?.trim()) overview.push(`> ${brand.tagline.trim()}`)
  if (brand.description?.trim()) overview.push(brand.description.trim())
  overview.push(
    `A ${brand.colorScheme ?? "light"}-mode design system extracted from [${opts.domain}](${opts.sourceUrl ?? `https://${opts.domain}`}) — colors, type scale, radii and component styles read from the live page's computed styles, not guessed.`,
  )
  body.push("\n## Overview\n")
  body.push(overview.join("\n\n"))

  // Colors
  if (colors.length > 0 || Object.keys(surface).length > 0) {
    body.push("\n## Colors\n")
    const lines: Array<string> = []
    if (surface.background)
      lines.push(`- **Background (${surface.background}):** page surface.`)
    if (surface.foreground)
      lines.push(`- **Foreground (${surface.foreground}):** primary text.`)
    if (surface.muted)
      lines.push(`- **Muted (${surface.muted}):** secondary text.`)
    if (surface.border)
      lines.push(`- **Border (${surface.border}):** dividers and outlines.`)
    colors.forEach((c, i) => {
      const role = (c.name ?? `Color ${i + 1}`).replace(/\b\w/g, (m) =>
        m.toUpperCase(),
      )
      const key = tokenKey(c.name, i)
      const hasScale = scaleByKey.get(key)
      lines.push(
        `- **${role} (${c.hex.toUpperCase()}):**${hasScale ? ` full \`${key}-50\`…\`${key}-950\` tonal scale generated.` : ""}`,
      )
    })
    body.push(lines.join("\n"))
  }

  // Typography
  if (fonts.length > 0 || typeScale.length > 0) {
    body.push("\n## Typography\n")
    const lines: Array<string> = []
    const fontLine = (label: string, f?: BrandFont) =>
      f ? `- **${label}:** ${f.name}` : null
    const fl = [
      fontLine("Headings", headingFont),
      fontLine("Body", bodyFont),
      fontLine("Mono", monoFont),
    ].filter(Boolean) as Array<string>
    lines.push(...fl)
    if (brand.fontWeights && brand.fontWeights.length > 0)
      lines.push(`- **Weights:** ${brand.fontWeights.join(", ")}`)
    for (const t of typeScale) {
      const bits = [t.fontSize]
      if (t.lineHeight) bits.push(`line-height ${t.lineHeight}`)
      if (t.fontWeight) bits.push(`weight ${t.fontWeight}`)
      lines.push(`- \`${typeTokenName(t.name)}\` — ${bits.join(", ")}`)
    }
    body.push(lines.join("\n"))
  }

  // Elevation & Depth
  if (shadows.length > 0) {
    body.push("\n## Elevation & Depth\n")
    body.push(
      shadows.map((s) => `- \`shadow-${s.name}\`: \`${s.value}\``).join("\n"),
    )
  }

  // Shapes
  if (radii.length > 0) {
    body.push("\n## Shapes\n")
    body.push(
      radii.map((r) => `- \`rounded-${r.name}\`: ${r.value}`).join("\n"),
    )
  }

  // Components
  if (button?.background) {
    body.push("\n## Components\n")
    const bits = [`background \`${button.background}\``]
    if (button.color) bits.push(`text \`${button.color}\``)
    if (button.borderRadius) bits.push(`radius ${button.borderRadius}`)
    body.push(
      `- **Button (primary):** ${bits.join(", ")}${
        button.paddingY && button.paddingX
          ? `, padding ${button.paddingY} ${button.paddingX}`
          : ""
      }.`,
    )
  }

  return `${fm.join("\n")}\n\n${body.join("\n")}\n`
}
