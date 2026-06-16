import { createFileRoute } from "@tanstack/react-router"
import { z } from "zod"
import { browser } from "@/lib/browser"
import { guardUrl } from "@/lib/url-guard"
import { DAY, cacheKey, readJsonCache, writeJsonCache } from "@/lib/cache"

/**
 * POST /api/markdown  → { url: string }  → { markdown, title, status }
 *
 *   await env.BROWSER.quickAction("markdown", { url })
 *
 * The markdown quick action returns a JSON body shaped like
 * `{ success, result, meta: { status, title } }`. We unwrap it for the UI.
 */
const bodySchema = z.object({
  url: z.string().url("Enter a valid http(s) URL"),
})

type MarkdownResult = {
  success?: boolean
  result?: string
  meta?: { status?: number; title?: string }
  errors?: Array<{ message?: string }>
}

export const Route = createFileRoute("/api/markdown")({
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
        const key = cacheKey("markdown", { url })

        const cached = await readJsonCache(key)
        if (cached) {
          return Response.json(cached, { headers: { "x-cache": "HIT" } })
        }

        try {
          const res = await browser.quickAction("markdown", {
            url,
            gotoOptions: { waitUntil: "networkidle2", timeout: 30000 },
          })

          const data = (await res.json().catch(() => null)) as MarkdownResult | null

          if (!res.ok || !data?.success || typeof data.result !== "string") {
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
            markdown: data.result,
            title: data.meta?.title ?? null,
            status: data.meta?.status ?? null,
          }
          await writeJsonCache(key, payload, DAY)
          return Response.json(payload, { headers: { "x-cache": "MISS" } })
        } catch (err) {
          return Response.json(
            { error: err instanceof Error ? err.message : "Markdown failed" },
            { status: 500 },
          )
        }
      },
    },
  },
})
