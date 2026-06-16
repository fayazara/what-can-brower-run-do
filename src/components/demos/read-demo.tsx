import { useState } from "react"
import { Button } from "@cloudflare/kumo/components/button"
import { LayerCard } from "@cloudflare/kumo/components/layer-card"
import { Check, Copy, FileText, Wand2 } from "lucide-react"

export function ReadDemo() {
  const [url, setUrl] = useState("https://blog.cloudflare.com")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [markdown, setMarkdown] = useState<string | null>(null)
  const [title, setTitle] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  async function read(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/markdown", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url }),
      })
      const body = (await res.json().catch(() => null)) as {
        markdown?: string
        title?: string | null
        error?: string
      } | null
      if (!res.ok || !body?.markdown) {
        throw new Error(body?.error ?? `Request failed (${res.status})`)
      }
      setMarkdown(body.markdown)
      setTitle(body.title ?? null)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong")
      setMarkdown(null)
      setTitle(null)
    } finally {
      setLoading(false)
    }
  }

  async function copy() {
    if (!markdown) return
    try {
      await navigator.clipboard.writeText(markdown)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      /* no-op */
    }
  }

  const wordCount = markdown
    ? markdown.trim().split(/\s+/).filter(Boolean).length
    : 0

  return (
    <div className="flex flex-col gap-5">
      <form onSubmit={read}>
        <LayerCard>
          <LayerCard.Secondary>Webpage URL</LayerCard.Secondary>
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
              <Wand2 className="h-4 w-4" />
              {loading ? "Reading…" : "Convert"}
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
            <span className="h-7 w-7 animate-spin rounded-full border-2 border-kumo-fill border-t-sky-500" />
            <span className="text-sm">Reading the page…</span>
          </div>
        </div>
      ) : markdown ? (
        <div className="overflow-hidden rounded-xl bg-kumo-base ring-1 ring-kumo-hairline">
          <div className="flex items-center justify-between gap-3 border-b border-kumo-hairline px-4 py-2.5">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-kumo-default">
                {title ?? "Extracted Markdown"}
              </p>
              <p className="tnum text-xs text-kumo-subtle">
                {wordCount.toLocaleString()} words
              </p>
            </div>
            <button
              type="button"
              onClick={copy}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium text-kumo-subtle transition-colors hover:bg-kumo-tint hover:text-kumo-default active:scale-[0.96]"
            >
              {copied ? (
                <Check className="h-4 w-4 text-emerald-500" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
          <pre className="max-h-[440px] overflow-auto px-4 py-4 text-[13px] leading-relaxed whitespace-pre-wrap text-kumo-default">
            {markdown}
          </pre>
        </div>
      ) : (
        <div className="grid min-h-64 place-items-center rounded-xl bg-kumo-tint ring-1 ring-kumo-hairline">
          <div className="flex flex-col items-center gap-2 text-kumo-subtle">
            <FileText className="h-7 w-7" strokeWidth={1.75} />
            <span className="text-sm">Clean Markdown will appear here</span>
          </div>
        </div>
      )}
    </div>
  )
}
