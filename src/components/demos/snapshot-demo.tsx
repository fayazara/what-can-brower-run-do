import { useState } from "react"
import { Button } from "@cloudflare/kumo/components/button"
import { LayerCard } from "@cloudflare/kumo/components/layer-card"
import { Check, Code2, Copy, Layers } from "lucide-react"

type Snapshot = {
  screenshot: string
  content: string
  contentLength: number
  title: string | null
  status: number | null
}

export function SnapshotDemo() {
  const [url, setUrl] = useState("https://example.com")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [snap, setSnap] = useState<Snapshot | null>(null)
  const [tab, setTab] = useState<"image" | "html">("image")
  const [copied, setCopied] = useState(false)

  async function run(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/snapshot", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url }),
      })
      const body = (await res.json().catch(() => null)) as
        | (Snapshot & { error?: string })
        | null
      if (!res.ok || !body?.screenshot) {
        throw new Error(body?.error ?? `Request failed (${res.status})`)
      }
      setSnap(body)
      setTab("image")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong")
      setSnap(null)
    } finally {
      setLoading(false)
    }
  }

  async function copyHtml() {
    if (!snap) return
    try {
      await navigator.clipboard.writeText(snap.content)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      /* no-op */
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <form onSubmit={run}>
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
              <Layers className="h-4 w-4" />
              {loading ? "Snapshotting…" : "Snapshot"}
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
        <Placeholder spinner />
      ) : snap ? (
        <div className="overflow-hidden rounded-xl bg-kumo-base ring-1 ring-kumo-hairline">
          <div className="flex items-center justify-between gap-3 border-b border-kumo-hairline px-3 py-2">
            <div className="flex gap-1">
              <TabButton active={tab === "image"} onClick={() => setTab("image")}>
                <Layers className="h-4 w-4" /> Screenshot
              </TabButton>
              <TabButton active={tab === "html"} onClick={() => setTab("html")}>
                <Code2 className="h-4 w-4" /> HTML
              </TabButton>
            </div>
            {tab === "html" ? (
              <button
                type="button"
                onClick={copyHtml}
                className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium text-kumo-subtle transition-colors hover:bg-kumo-tint hover:text-kumo-default active:scale-[0.96]"
              >
                {copied ? (
                  <Check className="h-4 w-4 text-emerald-500" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
                {copied ? "Copied" : "Copy"}
              </button>
            ) : (
              <span className="tnum pr-1 text-xs text-kumo-subtle">
                {snap.contentLength.toLocaleString()} chars of HTML
              </span>
            )}
          </div>

          {tab === "image" ? (
            <div className="p-3">
              <img
                src={snap.screenshot}
                alt={snap.title ?? "Snapshot"}
                className="img-outline w-full rounded-xl"
              />
            </div>
          ) : (
            <pre className="max-h-[440px] overflow-auto px-4 py-4 text-[12px] leading-relaxed whitespace-pre-wrap text-kumo-default">
              {snap.content}
            </pre>
          )}
        </div>
      ) : (
        <Placeholder />
      )}
    </div>
  )
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors active:scale-[0.96] ${
        active
          ? "bg-kumo-tint text-kumo-default"
          : "text-kumo-subtle hover:text-kumo-default"
      }`}
    >
      {children}
    </button>
  )
}

function Placeholder({ spinner }: { spinner?: boolean }) {
  return (
    <div className="grid min-h-64 place-items-center rounded-xl bg-kumo-tint ring-1 ring-kumo-hairline">
      <div className="flex flex-col items-center gap-2.5 text-kumo-subtle">
        {spinner ? (
          <>
            <span className="h-7 w-7 animate-spin rounded-full border-2 border-kumo-fill border-t-amber-500" />
            <span className="text-sm">Capturing HTML &amp; pixels…</span>
          </>
        ) : (
          <>
            <Layers className="h-7 w-7" strokeWidth={1.75} />
            <span className="text-sm">The snapshot will appear here</span>
          </>
        )}
      </div>
    </div>
  )
}
