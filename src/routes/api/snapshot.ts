import { createFileRoute } from "@tanstack/react-router"
import { z } from "zod"
import { browser } from "@/lib/browser"
import { guardUrl } from "@/lib/url-guard"
import { DAY, cacheKey, readJsonCache, writeJsonCache } from "@/lib/cache"

/**
 * POST /api/snapshot  → { url }  → { screenshot (data URI), content, title }
 *
 *   await env.BROWSER.quickAction("snapshot", { url })
 *
 * Returns the rendered HTML and a base64 screenshot in one request.
 */
const bodySchema = z.object({
  url: z.string().url("Enter a valid http(s) URL"),
})

type SnapshotResponse = {
  success?: boolean
  result?: { content?: string; screenshot?: string }
  meta?: { status?: number; title?: string }
  errors?: Array<{ message?: string }>
}

export const Route = createFileRoute("/api/snapshot")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let json: unknown
        try {
          json = await request.json()
        } catch {
          return Response.json({ error: "Invalid JSON" }, { status: 400 })
        }

        const parsed = bodySchema.safeParse(json)
        if (!parsed.success) {
          return Response.json(
            { error: parsed.error.issues[0]?.message ?? "Invalid input" },
            { status: 400 },
          )
        }

        const guard = await guardUrl(parsed.data.url)
        if (!guard.ok) {
          return Response.json({ error: guard.reason }, { status: guard.status })
        }
        const url = guard.url
        const key = cacheKey("snapshot", { url })

        const cached = await readJsonCache(key)
        if (cached) {
          return Response.json(cached, { headers: { "x-cache": "HIT" } })
        }

        try {
          const res = await browser.quickAction("snapshot", {
            url,
            gotoOptions: { waitUntil: "networkidle2", timeout: 30000 },
          })

          const data = (await res
            .json()
            .catch(() => null)) as SnapshotResponse | null

          if (!res.ok || !data?.success || !data.result?.screenshot) {
            return Response.json(
              {
                error:
                  data?.errors?.[0]?.message ??
                  `Browser Run returned ${res.status}`,
              },
              { status: 502 },
            )
          }

          const payload = {
            screenshot: `data:image/png;base64,${data.result.screenshot}`,
            content: data.result.content ?? "",
            contentLength: (data.result.content ?? "").length,
            title: data.meta?.title ?? null,
            status: data.meta?.status ?? null,
          }
          await writeJsonCache(key, payload, DAY)
          return Response.json(payload, { headers: { "x-cache": "MISS" } })
        } catch (err) {
          return Response.json(
            { error: err instanceof Error ? err.message : "Snapshot failed" },
            { status: 500 },
          )
        }
      },
    },
  },
})
