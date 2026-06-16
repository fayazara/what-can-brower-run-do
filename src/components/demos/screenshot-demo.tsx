import { useEffect, useRef, useState } from "react"
import { Button } from "@cloudflare/kumo/components/button"
import { LayerCard } from "@cloudflare/kumo/components/layer-card"
import { Camera, Download, ImageIcon } from "lucide-react"
import { Checkbox } from "@cloudflare/kumo"

export function ScreenshotDemo() {
  const [url, setUrl] = useState("https://cloudflare.com")
  const [fullPage, setFullPage] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [imgUrl, setImgUrl] = useState<string | null>(null)
  const [ms, setMs] = useState<number | null>(null)
  const lastObjectUrl = useRef<string | null>(null)

  useEffect(() => {
    return () => {
      if (lastObjectUrl.current) URL.revokeObjectURL(lastObjectUrl.current)
    }
  }, [])

  async function capture(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const started = performance.now()
    try {
      const res = await fetch("/api/screenshot", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url, fullPage }),
      })
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as {
          error?: string
        } | null
        throw new Error(body?.error ?? `Request failed (${res.status})`)
      }
      const blob = await res.blob()
      if (lastObjectUrl.current) URL.revokeObjectURL(lastObjectUrl.current)
      const objectUrl = URL.createObjectURL(blob)
      lastObjectUrl.current = objectUrl
      setImgUrl(objectUrl)
      setMs(Math.round(performance.now() - started))
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong")
      setImgUrl(null)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <form onSubmit={capture}>
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
                <Camera className="h-4 w-4" />
                {loading ? "Capturing…" : "Capture"}
              </Button>
            </div>
            <Checkbox
              label="Capture the full scrolling page"
              checked={fullPage}
              onCheckedChange={setFullPage}
            />
          </LayerCard.Primary>
        </LayerCard>
      </form>

      {error ? (
        <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700 ring-1 ring-red-100">
          {error}
        </p>
      ) : null}

      <ResultFrame loading={loading}>
        {imgUrl ? (
          <figure className="flex flex-col gap-3">
            <img
              src={imgUrl}
              alt="Screenshot result"
              className="img-outline w-full rounded-xl"
            />
            <figcaption className="flex items-center justify-between text-sm text-kumo-subtle">
              {ms !== null ? (
                <span>
                  Rendered in{" "}
                  <span className="tnum font-medium text-kumo-default">
                    {(ms / 1000).toFixed(2)}s
                  </span>
                </span>
              ) : (
                <span />
              )}
              <a
                href={imgUrl}
                download="screenshot.png"
                className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 font-medium text-kumo-subtle transition-colors hover:text-kumo-default active:scale-[0.96]"
              >
                <Download className="h-4 w-4" />
                Download PNG
              </a>
            </figcaption>
          </figure>
        ) : null}
      </ResultFrame>
    </div>
  )
}

/** Empty / loading / result container with a consistent look. */
function ResultFrame({
  loading,
  children,
}: {
  loading: boolean
  children: React.ReactNode
}) {
  const hasContent = Boolean(children) && !loading

  if (loading) {
    return (
      <div className="grid min-h-64 place-items-center rounded-xl bg-kumo-tint ring-1 ring-kumo-hairline">
        <div className="flex flex-col items-center gap-3 text-kumo-subtle">
          <span className="h-7 w-7 animate-spin rounded-full border-2 border-kumo-fill border-t-orange-500" />
          <span className="text-sm">Spinning up a browser…</span>
        </div>
      </div>
    )
  }

  if (!hasContent) {
    return (
      <div className="grid min-h-64 place-items-center rounded-xl bg-kumo-tint ring-1 ring-kumo-hairline">
        <div className="flex flex-col items-center gap-2 text-kumo-subtle">
          <ImageIcon className="h-7 w-7" strokeWidth={1.75} />
          <span className="text-sm">Your screenshot will appear here</span>
        </div>
      </div>
    )
  }

  return <div className="rounded-xl">{children}</div>
}
