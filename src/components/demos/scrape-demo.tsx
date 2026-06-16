import { useState } from "react"
import { Button } from "@cloudflare/kumo/components/button"
import { LayerCard } from "@cloudflare/kumo/components/layer-card"
import { Crosshair } from "lucide-react"

type ScrapeAttr = { name: string; value: string }
type ScrapeEl = {
  text: string
  attributes: Array<ScrapeAttr>
  width?: number
  height?: number
}
type ScrapeResult = { selector: string; count: number; elements: Array<ScrapeEl> }

export function ScrapeDemo() {
  const [url, setUrl] = useState("https://news.ycombinator.com")
  const [selector, setSelector] = useState(".titleline > a")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<ScrapeResult | null>(null)

  async function run(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/scrape", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url, selector }),
      })
      const body = (await res.json().catch(() => null)) as
        | (ScrapeResult & { error?: string })
        | null
      if (!res.ok || !body?.elements) {
        throw new Error(body?.error ?? `Request failed (${res.status})`)
      }
      setData(body)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong")
      setData(null)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <form onSubmit={run}>
        <LayerCard className="p-4">
        <div className="flex flex-col gap-3">
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-kumo-default">Webpage URL</span>
            <input
              type="url"
              required
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example.com"
              className={inputClass}
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-kumo-default">
              CSS selector
            </span>
            <input
              required
              value={selector}
              onChange={(e) => setSelector(e.target.value)}
              placeholder=".price, h2 a, [data-id]"
              className={`${inputClass} font-mono`}
            />
          </label>
        </div>
        <div className="mt-3 flex justify-end">
          <Button
            type="submit"
            variant="primary"
            loading={loading}
            disabled={loading}
          >
            <Crosshair className="h-4 w-4" />
            {loading ? "Scraping…" : "Scrape"}
          </Button>
        </div>
        </LayerCard>
      </form>

      {error ? (
        <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700 ring-1 ring-red-100">
          {error}
        </p>
      ) : null}

      {loading ? (
        <div className="grid min-h-64 place-items-center rounded-xl bg-kumo-tint ring-1 ring-kumo-hairline">
          <div className="flex flex-col items-center gap-2.5 text-kumo-subtle">
            <span className="h-7 w-7 animate-spin rounded-full border-2 border-kumo-fill border-t-rose-500" />
            <span className="text-sm">Matching elements…</span>
          </div>
        </div>
      ) : data ? (
        <div className="overflow-hidden rounded-xl bg-kumo-base ring-1 ring-kumo-hairline">
          <div className="border-b border-kumo-hairline px-4 py-2.5 text-sm text-kumo-subtle">
            <span className="tnum font-semibold text-kumo-default">
              {data.count}
            </span>{" "}
            match{data.count === 1 ? "" : "es"} for{" "}
            <code className="rounded bg-kumo-tint px-1 py-0.5 font-mono text-[12px] text-rose-700">
              {data.selector}
            </code>
          </div>
          {data.elements.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-kumo-subtle">
              No elements matched that selector.
            </p>
          ) : (
            <ul className="max-h-[460px] divide-y divide-kumo-hairline overflow-auto">
              {data.elements.map((el, i) => {
                const href = el.attributes.find((a) => a.name === "href")?.value
                const src = el.attributes.find((a) => a.name === "src")?.value
                return (
                  <li key={i} className="px-4 py-3">
                    {el.text ? (
                      <p className="text-sm text-kumo-default">{el.text}</p>
                    ) : (
                      <p className="text-sm text-kumo-subtle italic">
                        (no text content)
                      </p>
                    )}
                    {href ? (
                      <p className="mt-0.5 truncate font-mono text-xs text-kumo-subtle">
                        {href}
                      </p>
                    ) : null}
                    {src ? (
                      <p className="mt-0.5 truncate font-mono text-xs text-kumo-subtle">
                        {src}
                      </p>
                    ) : null}
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      ) : (
        <div className="grid min-h-64 place-items-center rounded-xl bg-kumo-tint ring-1 ring-kumo-hairline">
          <div className="flex flex-col items-center gap-2 text-kumo-subtle">
            <Crosshair className="h-7 w-7" strokeWidth={1.75} />
            <span className="text-sm">Scraped elements will appear here</span>
          </div>
        </div>
      )}
    </div>
  )
}

const inputClass =
  "min-w-0 rounded-lg bg-kumo-control px-3.5 py-2.5 text-sm text-kumo-default ring ring-kumo-line outline-none transition-[box-shadow] placeholder:text-kumo-subtle focus:ring-[1.5px] focus:ring-kumo-focus"
