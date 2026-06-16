import { createFileRoute } from "@tanstack/react-router"
import { z } from "zod"
import { browser } from "@/lib/browser"
import { guardUrl } from "@/lib/url-guard"
import {
  DAY,
  cacheKey,
  readBinaryCache,
  writeBinaryCache,
} from "@/lib/cache"

/**
 * POST /api/screenshot  → { url: string }  → image/png
 *
 * Renders the page in a real headless Chromium via Browser Run and streams
 * back a PNG. This is the whole demo:
 *
 *   await env.BROWSER.quickAction("screenshot", { url })
 */
const bodySchema = z.object({
  url: z.string().url("Enter a valid http(s) URL"),
  fullPage: z.boolean().optional().default(false),
})

export const Route = createFileRoute("/api/screenshot")({
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

        const { fullPage } = parsed.data

        // Screen the URL before spending a Browser Run call on it.
        const guard = await guardUrl(parsed.data.url)
        if (!guard.ok) {
          return Response.json({ error: guard.reason }, { status: guard.status })
        }
        const url = guard.url
        const key = cacheKey("screenshot", { url, fullPage })

        // Cache hit → serve the stored PNG straight from KV.
        const hit = await readBinaryCache(key)
        if (hit) {
          return new Response(hit.body, {
            headers: { "content-type": hit.contentType, "x-cache": "HIT" },
          })
        }

        try {
          const res = await browser.quickAction("screenshot", {
            url,
            viewport: { width: 1280, height: 800 },
            screenshotOptions: { fullPage },
            // Give SPAs a chance to paint before we snap.
            gotoOptions: { waitUntil: "networkidle2", timeout: 30000 },
          })

          if (!res.ok) {
            const detail = await res.text().catch(() => "")
            return Response.json(
              { error: `Browser Run returned ${res.status}`, detail },
              { status: 502 },
            )
          }

          const contentType = res.headers.get("content-type") ?? "image/png"
          const bytes = await res.arrayBuffer()
          await writeBinaryCache(key, bytes, contentType, DAY)

          return new Response(bytes, {
            headers: { "content-type": contentType, "x-cache": "MISS" },
          })
        } catch (err) {
          return Response.json(
            { error: err instanceof Error ? err.message : "Screenshot failed" },
            { status: 500 },
          )
        }
      },
    },
  },
})
