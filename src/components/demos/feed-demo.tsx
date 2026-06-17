import { useState } from "react"
import { Button } from "@cloudflare/kumo/components/button"
import { LayerCard } from "@cloudflare/kumo/components/layer-card"
import { CodeHighlighted } from "@cloudflare/kumo/code"
import { Rss, Check, Copy } from "lucide-react"

export function FeedDemo() {
  const [url, setUrl] = useState("https://blog.cloudflare.com")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [xml, setXml] = useState<string | null>(null)
  const [feedUrl, setFeedUrl] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  async function run(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setCopied(false)
    // The GET endpoint *is* the feed - this is the URL you'd paste into a reader.
    const target = `${window.location.origin}/api/feed?url=${encodeURIComponent(url)}`
    try {
      const res = await fetch(target)
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as {
          error?: string
        } | null
        throw new Error(body?.error ?? `Request failed (${res.status})`)
      }
      const body = await res.text()
      setXml(body)
      setFeedUrl(target)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong")
      setXml(null)
      setFeedUrl(null)
    } finally {
      setLoading(false)
    }
  }

  async function copyFeedUrl() {
    if (!feedUrl) return
    try {
      await navigator.clipboard.writeText(feedUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // clipboard can be unavailable; ignore
    }
  }

  const itemCount = xml ? (xml.match(/<item>/g) ?? []).length : 0

  return (
    <div className="flex flex-col gap-5">
      <form onSubmit={run}>
        <LayerCard className="p-4">
          <div className="flex flex-col gap-3">
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-kumo-default">
                Page to turn into a feed
              </span>
              <input
                type="url"
                required
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://example.com/blog"
                className={inputClass}
              />
            </label>
          </div>
          <div className="mt-3 flex items-center justify-between gap-3">
            <p className="text-xs text-kumo-subtle">
              Works best on blog indexes &amp; news pages. Uses Workers AI.
            </p>
            <Button
              type="submit"
              variant="primary"
              loading={loading}
              disabled={loading}
            >
              <Rss className="h-4 w-4" />
              {loading ? "Building feed…" : "Generate feed"}
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
            <span className="h-7 w-7 animate-spin rounded-full border-2 border-kumo-fill border-t-orange-500" />
            <span className="text-sm">Reading the page &amp; finding articles…</span>
          </div>
        </div>
      ) : xml ? (
        <div className="flex flex-col gap-3">
          {feedUrl ? (
            <div className="flex flex-col gap-2 rounded-xl bg-kumo-tint p-3 ring-1 ring-kumo-hairline">
              <span className="text-xs font-medium text-kumo-subtle">
                Subscribable feed URL{" "}
                <span className="font-normal">
                  · {itemCount} {itemCount === 1 ? "item" : "items"}
                </span>
              </span>
              <div className="flex items-center gap-2">
                <code className="min-w-0 flex-1 truncate rounded-lg bg-kumo-control px-3 py-2 font-mono text-[12px] text-kumo-default ring ring-kumo-line">
                  {feedUrl}
                </code>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={copyFeedUrl}
                  aria-label="Copy feed URL"
                >
                  {copied ? (
                    <Check className="h-4 w-4 text-emerald-600" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                  {copied ? "Copied" : "Copy"}
                </Button>
              </div>
            </div>
          ) : null}
          <div className="max-h-[420px] overflow-auto rounded-xl text-[13px] ring-1 ring-kumo-hairline">
            <CodeHighlighted code={xml} lang="html" showCopyButton />
          </div>
        </div>
      ) : (
        <div className="grid min-h-64 place-items-center rounded-xl bg-kumo-tint ring-1 ring-kumo-hairline">
          <div className="flex flex-col items-center gap-2 text-kumo-subtle">
            <Rss className="h-7 w-7" strokeWidth={1.75} />
            <span className="text-sm">Your RSS feed will appear here</span>
          </div>
        </div>
      )}
    </div>
  )
}

const inputClass =
  "min-w-0 rounded-lg bg-kumo-control px-3.5 py-2.5 text-sm text-kumo-default ring ring-kumo-line outline-none transition-[box-shadow] placeholder:text-kumo-subtle focus:ring-[1.5px] focus:ring-kumo-focus"
