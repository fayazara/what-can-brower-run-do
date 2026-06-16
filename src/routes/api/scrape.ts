import { createFileRoute } from "@tanstack/react-router"
import { z } from "zod"
import { browser } from "@/lib/browser"
import { guardUrl } from "@/lib/url-guard"
import { DAY, cacheKey, readJsonCache, writeJsonCache } from "@/lib/cache"

/**
 * POST /api/scrape  → { url, selector }  → { count, elements }
 *
 *   await env.BROWSER.quickAction("scrape", {
 *     url,
 *     elements: [{ selector }],
 *   })
 */
const bodySchema = z.object({
  url: z.string().url("Enter a valid http(s) URL"),
  selector: z.string().trim().min(1, "Enter a CSS selector").max(200),
})

type ScrapeAttr = { name: string; value: string }
type ScrapeEl = {
  text?: string
  html?: string
  width?: number
  height?: number
  attributes?: Array<ScrapeAttr>
}
type ScrapeResponse = {
  success?: boolean
  result?: Array<{ selector: string; results: Array<ScrapeEl> }>
  errors?: Array<{ message?: string }>
}

export const Route = createFileRoute("/api/scrape")({
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

        const { selector } = parsed.data

        const guard = await guardUrl(parsed.data.url)
        if (!guard.ok) {
          return Response.json({ error: guard.reason }, { status: guard.status })
        }
        const url = guard.url
        const key = cacheKey("scrape", { url, selector })

        const cached = await readJsonCache(key)
        if (cached) {
          return Response.json(cached, { headers: { "x-cache": "HIT" } })
        }

        try {
          const res = await browser.quickAction("scrape", {
            url,
            elements: [{ selector }],
            gotoOptions: { waitUntil: "networkidle2", timeout: 30000 },
          })

          const data = (await res
            .json()
            .catch(() => null)) as ScrapeResponse | null

          if (!res.ok || !data?.success || !Array.isArray(data.result)) {
            return Response.json(
              {
                error:
                  data?.errors?.[0]?.message ??
                  `Browser Run returned ${res.status}`,
              },
              { status: 502 },
            )
          }

          const found = data.result[0]?.results ?? []
          const elements = found.slice(0, 100).map((el) => ({
            text: (el.text ?? "").trim(),
            attributes: el.attributes ?? [],
            width: el.width,
            height: el.height,
          }))

          const payload = { selector, count: found.length, elements }
          await writeJsonCache(key, payload, DAY)
          return Response.json(payload, { headers: { "x-cache": "MISS" } })
        } catch (err) {
          return Response.json(
            { error: err instanceof Error ? err.message : "Scrape failed" },
            { status: 500 },
          )
        }
      },
    },
  },
})
