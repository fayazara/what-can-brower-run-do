import { useState } from "react"
import { Button } from "@cloudflare/kumo/components/button"
import { LayerCard } from "@cloudflare/kumo/components/layer-card"
import { ExternalLink, Link2 } from "lucide-react"

type LinksResult = {
  count: number
  internal: Array<string>
  external: Array<string>
}

export function LinksDemo() {
  const [url, setUrl] = useState("https://developers.cloudflare.com/browser-run")
  const [excludeExternal, setExcludeExternal] = useState(false)
  const [visibleOnly, setVisibleOnly] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<LinksResult | null>(null)

  async function run(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/links", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url, excludeExternal, visibleOnly }),
      })
      const body = (await res.json().catch(() => null)) as
        | (LinksResult & { error?: string })
        | null
      if (!res.ok || !body?.internal) {
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
        <LayerCard>
          <LayerCard.Secondary>Webpage URL</LayerCard.Secondary>
          <LayerCard.Primary>
            <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center">
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
                <Link2 className="h-4 w-4" />
                {loading ? "Finding…" : "Get links"}
              </Button>
            </div>

            <div className="flex flex-wrap gap-x-5 gap-y-2">
              <Toggle
                label="Exclude external links"
                checked={excludeExternal}
                onChange={setExcludeExternal}
              />
              <Toggle
                label="Visible links only"
                checked={visibleOnly}
                onChange={setVisibleOnly}
              />
            </div>
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
          <div className="flex flex-col items-center gap-2.5 text-kumo-subtle">
            <span className="h-7 w-7 animate-spin rounded-full border-2 border-kumo-fill border-t-teal-500" />
            <span className="text-sm">Collecting links…</span>
          </div>
        </div>
      ) : data ? (
        <div className="overflow-hidden rounded-xl bg-kumo-base ring-1 ring-kumo-hairline">
          <div className="flex items-center gap-4 border-b border-kumo-hairline px-4 py-2.5 text-sm">
            <span className="font-medium text-kumo-default">
              <span className="tnum font-semibold text-kumo-default">
                {data.count}
              </span>{" "}
              links
            </span>
            <span className="tnum text-kumo-subtle">
              {data.internal.length} internal
            </span>
            <span className="tnum text-kumo-subtle">
              {data.external.length} external
            </span>
          </div>
          <ul className="max-h-[460px] divide-y divide-kumo-hairline overflow-auto">
            {[...data.internal, ...data.external].map((link, i) => {
              const isExternal = data.external.includes(link)
              return (
                <li key={`${link}-${i}`}>
                  <a
                    href={link}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-2 px-4 py-2 transition-colors hover:bg-kumo-tint"
                  >
                    <span
                      className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                        isExternal ? "bg-amber-400" : "bg-teal-500"
                      }`}
                    />
                    <span className="truncate font-mono text-xs text-kumo-subtle">
                      {link}
                    </span>
                    {isExternal ? (
                      <ExternalLink className="ml-auto h-3.5 w-3.5 shrink-0 text-kumo-subtle" />
                    ) : null}
                  </a>
                </li>
              )
            })}
          </ul>
        </div>
      ) : (
        <div className="grid min-h-64 place-items-center rounded-xl bg-kumo-tint ring-1 ring-kumo-hairline">
          <div className="flex flex-col items-center gap-2 text-kumo-subtle">
            <Link2 className="h-7 w-7" strokeWidth={1.75} />
            <span className="text-sm">Every link on the page will list here</span>
          </div>
        </div>
      )}
    </div>
  )
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string
  checked: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-kumo-subtle select-none">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 rounded border-kumo-fill text-teal-500 accent-teal-500"
      />
      {label}
    </label>
  )
}
