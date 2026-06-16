import { useEffect, useState } from "react"
import { Link } from "@tanstack/react-router"
import { Button } from "@cloudflare/kumo/components/button"
import { LayerCard } from "@cloudflare/kumo/components/layer-card"
import { Palette, RefreshCw, Share2, Zap } from "lucide-react"
import type { BrandKit } from "@/lib/brand"
import type { RecentBrand } from "@/server/brand-fns"
import { BrandLogo, BrandOverview } from "@/components/brand-card"
import { listRecentBrands } from "@/server/brand-fns"

/** Bare host for building the /brand/{domain} permalink. */
function hostOf(rawUrl: string): string {
  try {
    return new URL(rawUrl).hostname.replace(/^www\./, "").toLowerCase()
  } catch {
    return rawUrl
  }
}

export function BrandDemo() {
  const [url, setUrl] = useState("https://cloudflare.com")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [brand, setBrand] = useState<BrandKit | null>(null)
  const [resolvedUrl, setResolvedUrl] = useState<string | null>(null)
  const [cached, setCached] = useState(false)
  const [ms, setMs] = useState<number | null>(null)

  async function extract(refresh: boolean) {
    setLoading(true)
    setError(null)
    const started = performance.now()
    try {
      const res = await fetch("/api/brand", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url, refresh }),
      })
      const body = (await res.json().catch(() => null)) as {
        brand?: BrandKit
        url?: string
        cached?: boolean
        error?: string
      } | null
      if (!res.ok || !body?.brand) {
        throw new Error(body?.error ?? `Request failed (${res.status})`)
      }
      setBrand(body.brand)
      setResolvedUrl(body.url ?? url)
      setCached(Boolean(body.cached))
      setMs(Math.round(performance.now() - started))
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong")
      setBrand(null)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <form
        onSubmit={(e) => {
          e.preventDefault()
          extract(false)
        }}
      >
        <LayerCard>
          <LayerCard.Secondary>Website URL</LayerCard.Secondary>
          <LayerCard.Primary className="flex flex-col gap-2.5 sm:flex-row sm:items-center">
            <input
              type="url"
              required
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example.com"
              className="min-w-0 flex-1 rounded-lg bg-kumo-control px-3.5 py-2.5 text-sm text-kumo-default ring ring-kumo-line transition-[box-shadow] outline-none placeholder:text-kumo-subtle focus:ring-[1.5px] focus:ring-kumo-focus"
            />
            <Button
              type="submit"
              variant="primary"
              loading={loading}
              disabled={loading}
            >
              <Palette className="h-4 w-4" />
              {loading ? "Reading…" : "Extract"}
            </Button>
          </LayerCard.Primary>
        </LayerCard>
      </form>

      {error ? (
        <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700 ring-1 ring-red-100">
          {error}
        </p>
      ) : null}

      {loading ? (
        <div className="grid min-h-64 place-items-center rounded-xl bg-kumo-tint ring-1 ring-kumo-hairline">
          <div className="flex flex-col items-center gap-3 text-kumo-subtle">
            <span className="h-7 w-7 animate-spin rounded-full border-2 border-kumo-fill border-t-kumo-default" />
            <span className="text-sm">
              Rendering the page &amp; reading the brand…
            </span>
          </div>
        </div>
      ) : brand ? (
        <BrandCard
          brand={brand}
          domain={hostOf(resolvedUrl ?? url)}
          cached={cached}
          ms={ms}
          onRefresh={() => extract(true)}
        />
      ) : (
        <div className="grid min-h-64 place-items-center rounded-xl bg-kumo-tint ring-1 ring-kumo-hairline">
          <div className="flex flex-col items-center gap-2 text-kumo-subtle">
            <Palette className="h-7 w-7" strokeWidth={1.75} />
            <span className="text-sm">The brand kit will appear here</span>
          </div>
        </div>
      )}

      <RecentBrands />
    </div>
  )
}

function BrandCard({
  brand,
  domain,
  cached,
  ms,
  onRefresh,
}: {
  brand: BrandKit
  domain: string
  cached: boolean
  ms: number | null
  onRefresh: () => void
}) {
  return (
    <div className="overflow-hidden rounded-xl bg-kumo-base ring-1 ring-kumo-hairline">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 border-b border-kumo-hairline p-5">
        <div className="flex min-w-0 items-center gap-4">
          <BrandLogo
            brand={brand}
            className="img-outline h-14 w-14 rounded-xl bg-kumo-tint object-contain p-1.5"
          />
          <div className="min-w-0">
            <h3 className="truncate text-lg font-semibold tracking-tight text-kumo-default">
              {brand.name ?? "Unknown brand"}
            </h3>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${
              cached
                ? "bg-emerald-100 text-emerald-700"
                : "bg-violet-100 text-violet-700"
            }`}
            title={
              cached
                ? "Served instantly from Workers KV"
                : "Freshly extracted via Browser Run + AI"
            }
          >
            {cached ? (
              <Zap className="h-3.5 w-3.5" />
            ) : (
              <Palette className="h-3.5 w-3.5" />
            )}
            {cached ? "Cached" : "Fresh"}
            {ms !== null ? (
              <span className="tnum opacity-70">
                · {(ms / 1000).toFixed(2)}s
              </span>
            ) : null}
          </span>
          <Link
            to="/brand/$domain"
            params={{ domain }}
            title="Open shareable page & DESIGN.md"
            aria-label="Open shareable page & DESIGN.md"
            className="grid h-8 w-8 place-items-center rounded-lg bg-kumo-tint text-kumo-subtle ring-1 ring-kumo-hairline transition-[colors,transform] hover:bg-kumo-fill hover:text-kumo-default active:scale-[0.94]"
          >
            <Share2 className="h-4 w-4" />
          </Link>
        </div>
      </div>

      <div className="flex flex-col gap-5 p-5">
        <BrandOverview brand={brand} />

        <button
          type="button"
          onClick={onRefresh}
          className="inline-flex items-center gap-1.5 self-start rounded-lg px-2 py-1.5 text-sm font-medium text-kumo-subtle transition-colors hover:text-kumo-default active:scale-[0.96]"
        >
          <RefreshCw className="h-4 w-4" />
          Re-extract (skip cache)
        </button>
      </div>
    </div>
  )
}

/** The public directory: recently generated brand pages from D1. */
function RecentBrands() {
  const [recent, setRecent] = useState<Array<RecentBrand>>([])

  useEffect(() => {
    let active = true
    listRecentBrands()
      .then((rows) => {
        if (active) setRecent(rows)
      })
      .catch(() => {})
    return () => {
      active = false
    }
  }, [])

  if (recent.length === 0) return null

  return (
    <section className="mt-2">
      <h4 className="mb-2.5 text-xs font-semibold tracking-wide text-kumo-subtle uppercase">
        Recently generated
      </h4>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {recent.map((b) => (
          <Link
            key={b.domain}
            to="/brand/$domain"
            params={{ domain: b.domain }}
            className="group flex items-center gap-3 rounded-xl bg-kumo-base p-3 ring-1 ring-kumo-hairline transition-[transform,box-shadow] hover:-translate-y-0.5 hover:shadow-sm active:scale-[0.98]"
          >
            {b.logoUrl ? (
              <img
                src={b.logoUrl}
                alt=""
                className="img-outline h-8 w-8 shrink-0 rounded-lg bg-kumo-tint object-contain p-1"
                onError={(e) => {
                  e.currentTarget.style.visibility = "hidden"
                }}
              />
            ) : (
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-kumo-tint">
                <Palette className="h-4 w-4 text-kumo-subtle" />
              </span>
            )}
            <span className="min-w-0">
              <span className="block truncate text-sm font-medium text-kumo-default">
                {b.name ?? b.domain}
              </span>
              <span className="block truncate text-xs text-kumo-subtle">
                {b.domain}
              </span>
            </span>
          </Link>
        ))}
      </div>
    </section>
  )
}
