import { useState } from "react"
import { Button } from "@cloudflare/kumo/components/button"
import { LayerCard } from "@cloudflare/kumo/components/layer-card"
import { CodeHighlighted } from "@cloudflare/kumo/code"
import { Braces } from "lucide-react"

export function ExtractDemo() {
  const [url, setUrl] = useState("https://news.ycombinator.com")
  const [prompt, setPrompt] = useState("Extract the top stories")
  const [fields, setFields] = useState("title, points, author")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<Record<string, unknown> | null>(null)

  async function run(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const fieldList = fields
        .split(",")
        .map((f) => f.trim())
        .filter(Boolean)
      const res = await fetch("/api/extract", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url, prompt, fields: fieldList }),
      })
      const body = (await res.json().catch(() => null)) as {
        result?: Record<string, unknown>
        error?: string
      } | null
      if (!res.ok || !body?.result) {
        throw new Error(body?.error ?? `Request failed (${res.status})`)
      }
      setResult(body.result)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong")
      setResult(null)
    } finally {
      setLoading(false)
    }
  }

  const pretty = result ? JSON.stringify(result, null, 2) : ""

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
              What should we extract?
            </span>
            <textarea
              required
              rows={2}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="e.g. the products on this page"
              className={`${inputClass} resize-none`}
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-kumo-default">
              Fields{" "}
              <span className="font-normal text-kumo-subtle">
                (comma-separated - builds the JSON schema)
              </span>
            </span>
            <input
              value={fields}
              onChange={(e) => setFields(e.target.value)}
              placeholder="name, price, availability"
              className={`${inputClass} font-mono`}
            />
          </label>
        </div>
        <div className="mt-3 flex items-center justify-between gap-3">
          <p className="text-xs text-kumo-subtle">Uses Workers AI under the hood.</p>
          <Button
            type="submit"
            variant="primary"
            loading={loading}
            disabled={loading}
          >
            <Braces className="h-4 w-4" />
            {loading ? "Extracting…" : "Extract"}
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
            <span className="h-7 w-7 animate-spin rounded-full border-2 border-kumo-fill border-t-indigo-500" />
            <span className="text-sm">Reading the page &amp; thinking…</span>
          </div>
        </div>
      ) : result ? (
        <div className="max-h-[460px] overflow-auto rounded-xl text-[13px] ring-1 ring-kumo-hairline">
          <CodeHighlighted code={pretty} lang="json" showCopyButton />
        </div>
      ) : (
        <div className="grid min-h-64 place-items-center rounded-xl bg-kumo-tint ring-1 ring-kumo-hairline">
          <div className="flex flex-col items-center gap-2 text-kumo-subtle">
            <Braces className="h-7 w-7" strokeWidth={1.75} />
            <span className="text-sm">Structured JSON will appear here</span>
          </div>
        </div>
      )}
    </div>
  )
}

const inputClass =
  "min-w-0 rounded-lg bg-kumo-control px-3.5 py-2.5 text-sm text-kumo-default ring ring-kumo-line outline-none transition-[box-shadow] placeholder:text-kumo-subtle focus:ring-[1.5px] focus:ring-kumo-focus"
