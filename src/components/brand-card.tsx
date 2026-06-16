import { useState } from "react"
import { Check, Type } from "lucide-react"
import type { BrandColor, BrandKit } from "@/lib/brand"
import { generateScale, readableTextColor } from "@/lib/color"

/**
 * Shared, presentational design-system pieces used by both the interactive demo
 * (`brand-demo.tsx`) and the shareable `/brand/{domain}` permalink page. Pure
 * UI — no fetching, no server imports (BrandKit is a type-only import).
 */

const SCALED_ROLES = new Set(["primary", "secondary", "accent"])

/** Clipboard helper with a short-lived "copied" flag keyed by value. */
function useCopy() {
  const [copied, setCopied] = useState<string | null>(null)
  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(text)
      setTimeout(() => setCopied((c) => (c === text ? null : c)), 1100)
    } catch {
      /* no-op */
    }
  }
  return { copied, copy }
}

/** Brand logo (handles inline-SVG data URIs and <img> logos/icons alike). */
export function BrandLogo({
  brand,
  className,
}: {
  brand: BrandKit
  className?: string
}) {
  const src = brand.logoUrl || brand.icon
  if (!src) return null
  return (
    <img
      src={src}
      alt={`${brand.name ?? "Brand"} logo`}
      className={className}
      onError={(e) => {
        e.currentTarget.style.display = "none"
      }}
    />
  )
}

/** The full design system: colors + scales, type, radii, shadows, button. */
export function BrandOverview({ brand }: { brand: BrandKit }) {
  const colors = brand.colors ?? []
  const surface = brand.surface ?? {}
  const flatColors = colors.filter(
    (c) => !SCALED_ROLES.has((c.name ?? "").toLowerCase()),
  )
  const surfaceTokens = [
    surface.background ? { name: "background", hex: surface.background } : null,
    surface.foreground ? { name: "foreground", hex: surface.foreground } : null,
    surface.muted ? { name: "muted", hex: surface.muted } : null,
    surface.border ? { name: "border", hex: surface.border } : null,
  ].filter(Boolean) as Array<BrandColor>

  const typeScale = brand.typeScale ?? []
  const radii = brand.radii ?? []
  const shadows = brand.shadows ?? []
  const headingName = brand.fonts?.find((f) => f.usage === "headings")?.name

  return (
    <div className="flex flex-col gap-6">
      {brand.tagline ? (
        <p className="text-[15px] font-medium text-kumo-default">
          “{brand.tagline}”
        </p>
      ) : null}
      {brand.description ? (
        <p className="text-sm leading-relaxed text-kumo-subtle">
          {brand.description}
        </p>
      ) : null}

      {/* Color scales */}
      {colors.some((c) => SCALED_ROLES.has((c.name ?? "").toLowerCase())) ? (
        <Section title="Color scales">
          <div className="flex flex-col gap-4">
            {colors
              .filter((c) => SCALED_ROLES.has((c.name ?? "").toLowerCase()))
              .map((c) => (
                <ColorScaleRow
                  key={c.name}
                  role={(c.name ?? "color").toLowerCase()}
                  hex={c.hex}
                />
              ))}
          </div>
        </Section>
      ) : null}

      {/* Surface + remaining flat colors */}
      {surfaceTokens.length > 0 || flatColors.length > 0 ? (
        <Section title="Core colors">
          <div className="flex flex-wrap gap-2">
            {surfaceTokens.map((c) => (
              <Swatch key={`s-${c.name}`} color={c} />
            ))}
            {flatColors.map((c, i) => (
              <Swatch key={`${c.hex}-${i}`} color={c} />
            ))}
          </div>
        </Section>
      ) : null}

      {/* Typography */}
      {brand.fonts && brand.fonts.length > 0 ? (
        <Section title="Typefaces">
          <div className="flex flex-wrap gap-2">
            {brand.fonts.map((f, i) => (
              <div
                key={`${f.name}-${i}`}
                className="flex items-center gap-2 rounded-xl bg-kumo-tint px-3 py-2 ring-1 ring-kumo-hairline"
              >
                <Type className="h-4 w-4 text-kumo-subtle" />
                <span
                  className="text-sm font-medium text-kumo-default"
                  style={{ fontFamily: `${f.name}, sans-serif` }}
                >
                  {f.name}
                </span>
                {f.usage ? (
                  <span className="text-xs text-kumo-subtle">{f.usage}</span>
                ) : null}
              </div>
            ))}
          </div>
        </Section>
      ) : null}

      {/* Type scale */}
      {typeScale.length > 0 ? (
        <Section title="Type scale">
          <div className="rounded-xl bg-kumo-tint px-4 ring-1 ring-kumo-hairline">
            {typeScale.map((t) => (
              <div
                key={t.name}
                className="flex items-baseline justify-between gap-4 border-b border-kumo-hairline py-2.5 last:border-0"
              >
                <span
                  className="truncate text-kumo-default"
                  style={{
                    fontSize: `min(${t.fontSize}, 2.25rem)`,
                    fontWeight: t.fontWeight ?? undefined,
                    fontFamily: `${t.fontFamily ?? headingName ?? "inherit"}, sans-serif`,
                    lineHeight: 1.1,
                  }}
                >
                  {t.name}
                </span>
                <span className="tnum shrink-0 text-xs text-kumo-subtle">
                  {t.fontSize}
                  {t.fontWeight ? ` · ${t.fontWeight}` : ""}
                </span>
              </div>
            ))}
          </div>
        </Section>
      ) : null}

      {/* Radii + Shadows */}
      {radii.length > 0 ? (
        <Section title="Radius">
          <div className="flex flex-wrap gap-2">
            {radii.map((r) => (
              <div
                key={r.name}
                className="flex items-center gap-6"
              >
                <span
                  className="img-outline h-9 w-9 bg-kumo-fill"
                  style={{ borderRadius: r.value }}
                />
                <span className="text-left">
                  <span className="block text-xs font-medium text-kumo-default">
                    {r.name}
                  </span>
                  <span className="tnum block text-xs text-kumo-subtle">
                    {r.value}
                  </span>
                </span>
              </div>
            ))}
          </div>
        </Section>
      ) : null}

      {shadows.length > 0 ? (
        <Section title="Elevation">
          <div className="flex flex-wrap gap-3">
            {shadows.map((s) => (
              <div
                key={s.name}
                className="grid h-16 w-24 place-items-center rounded-xl bg-kumo-base text-xs font-medium text-kumo-subtle"
                style={{ boxShadow: s.value }}
                title={s.value}
              >
                {s.name}
              </div>
            ))}
          </div>
        </Section>
      ) : null}

      {/* Primary button */}
      {brand.button?.background ? (
        <Section title="Primary button">
          <div className="flex items-center gap-3">
            <button
              type="button"
              style={{
                backgroundColor: brand.button.background,
                color: brand.button.color ?? "#fff",
                borderRadius: brand.button.borderRadius ?? "8px",
                paddingTop: brand.button.paddingY ?? "8px",
                paddingBottom: brand.button.paddingY ?? "8px",
                paddingLeft: brand.button.paddingX ?? "16px",
                paddingRight: brand.button.paddingX ?? "16px",
                fontSize: brand.button.fontSize ?? undefined,
                fontWeight: brand.button.fontWeight ?? undefined,
              }}
            >
              Get started
            </button>
            <span className="tnum text-xs text-kumo-subtle">
              {brand.button.background}
            </span>
          </div>
        </Section>
      ) : null}

      {/* Social card (og:image) */}
      {brand.ogImage ? (
        <Section title="Social card">
          <img
            src={brand.ogImage}
            alt={`${brand.name ?? "Brand"} social share image`}
            loading="lazy"
            className="img-outline aspect-[1200/630] w-full rounded-xl bg-kumo-tint object-cover"
            onError={(e) => {
              e.currentTarget.style.display = "none"
            }}
          />
        </Section>
      ) : null}
    </div>
  )
}

function Section({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <section>
      <h4 className="mb-2.5 text-xs font-semibold tracking-wide text-kumo-subtle uppercase">
        {title}
      </h4>
      {children}
    </section>
  )
}

/** A uicolors-style 50…950 tonal scale strip; each cell copies its hex. */
function ColorScaleRow({ role, hex }: { role: string; hex: string }) {
  const scale = generateScale(hex)
  const { copied, copy } = useCopy()
  if (!scale) return null

  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-xs font-medium text-kumo-default capitalize">
          {role}
        </span>
        <span className="tnum text-xs text-kumo-subtle">{scale.base}</span>
      </div>
      <div className="flex overflow-hidden rounded-lg ring-1 ring-kumo-hairline">
        {scale.shades.map((s) => {
          const text = readableTextColor(s.hex)
          const isBase = s.stop === scale.baseStop
          return (
            <button
              key={s.stop}
              type="button"
              onClick={() => copy(s.hex)}
              title={`${role}-${s.stop} · ${s.hex}`}
              className="relative flex-1 cursor-pointer transition-[flex] active:flex-[1.3]"
              style={{ backgroundColor: s.hex }}
            >
              <span
                className="flex h-12 flex-col items-center justify-center gap-1"
                style={{ color: text }}
              >
                <span className="tnum text-[10px] font-semibold opacity-90">
                  {copied === s.hex ? "✓" : s.stop}
                </span>
                {isBase ? (
                  <span
                    className="h-1 w-1 rounded-full"
                    style={{ backgroundColor: text }}
                  />
                ) : null}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

/** A color chip you can click to copy its hex. */
export function Swatch({ color }: { color: BrandColor }) {
  const [copied, setCopied] = useState(false)

  async function copy() {
    try {
      await navigator.clipboard.writeText(color.hex)
      setCopied(true)
      setTimeout(() => setCopied(false), 1200)
    } catch {
      /* no-op */
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      className="group flex items-center gap-2.5 rounded-xl bg-kumo-tint py-1.5 pr-3 pl-1.5 ring-1 ring-kumo-hairline transition-transform active:scale-[0.96]"
      title={`Copy ${color.hex}`}
    >
      <span
        className="img-outline h-9 w-9 rounded-lg"
        style={{ backgroundColor: color.hex }}
      />
      <span className="text-left">
        {color.name ? (
          <span className="block text-xs font-medium text-kumo-default capitalize">
            {color.name}
          </span>
        ) : null}
        <span className="tnum flex items-center gap-1 text-xs text-kumo-subtle uppercase">
          {copied ? (
            <>
              <Check className="h-3 w-3 text-emerald-500" /> copied
            </>
          ) : (
            color.hex
          )}
        </span>
      </span>
    </button>
  )
}
