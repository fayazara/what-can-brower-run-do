import { createFileRoute } from "@tanstack/react-router"
import { z } from "zod"
import { browser } from "@/lib/browser"
import { guardUrl } from "@/lib/url-guard"
import { DAY, cacheKey, readJsonCache, writeJsonCache } from "@/lib/cache"

/**
 * POST /api/links  → { url, excludeExternal?, visibleOnly? }  → { links, count }
 *
 *   await env.BROWSER.quickAction("links", {
 *     url,
 *     excludeExternalLinks,
 *     visibleLinksOnly,
 *   })
 */
const bodySchema = z.object({
  url: z.string().url("Enter a valid http(s) URL"),
  excludeExternal: z.boolean().optional().default(false),
  visibleOnly: z.boolean().optional().default(false),
})

type LinksResponse = {
  success?: boolean
  result?: Array<string>
  errors?: Array<{ message?: string }>
}

export const Route = createFileRoute("/api/links")({
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

        const { excludeExternal, visibleOnly } = parsed.data

        const guard = await guardUrl(parsed.data.url)
        if (!guard.ok) {
          return Response.json({ error: guard.reason }, { status: guard.status })
        }
        const url = guard.url
        const key = cacheKey("links", { url, excludeExternal, visibleOnly })

        const cached = await readJsonCache(key)
        if (cached) {
          return Response.json(cached, { headers: { "x-cache": "HIT" } })
        }

        try {
          const res = await browser.quickAction("links", {
            url,
            excludeExternalLinks: excludeExternal,
            visibleLinksOnly: visibleOnly,
            gotoOptions: { waitUntil: "networkidle2", timeout: 30000 },
          })

          const data = (await res.json().catch(() => null)) as LinksResponse | null

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

          // Split internal vs external relative to the requested origin.
          let host = ""
          try {
            host = new URL(url).host
          } catch {
            /* ignore */
          }
          const internal: Array<string> = []
          const external: Array<string> = []
          for (const link of data.result) {
            try {
              if (new URL(link).host === host) internal.push(link)
              else external.push(link)
            } catch {
              internal.push(link)
            }
          }

          const payload = {
            count: data.result.length,
            internal,
            external,
          }
          await writeJsonCache(key, payload, DAY)
          return Response.json(payload, { headers: { "x-cache": "MISS" } })
        } catch (err) {
          return Response.json(
            { error: err instanceof Error ? err.message : "Links failed" },
            { status: 500 },
          )
        }
      },
    },
  },
})
