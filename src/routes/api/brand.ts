import { createFileRoute } from "@tanstack/react-router"
import { z } from "zod"
import { extractBrand } from "@/lib/brand"

/**
 * POST /api/brand  → { url: string, refresh?: boolean }  → BrandKit
 *
 * Thin HTTP wrapper around the shared `extractBrand` pipeline in
 * `@/lib/brand`. The same engine powers the `/brand/{domain}` shareable
 * permalink pages, so there's one source of truth for how a brand kit is read
 * (real headless browser → computed styles/meta → KV cache → D1 directory).
 */
const bodySchema = z.object({
  url: z.string().url("Enter a valid http(s) URL"),
  refresh: z.boolean().optional().default(false),
})

export const Route = createFileRoute("/api/brand")({
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

        try {
          const { url, brand, cached } = await extractBrand(parsed.data.url, {
            refresh: parsed.data.refresh,
          })
          return Response.json({ cached, url, brand })
        } catch (err) {
          const status =
            (err as { status?: number }).status ?? 500
          return Response.json(
            {
              error:
                err instanceof Error ? err.message : "Brand extraction failed",
            },
            { status },
          )
        }
      },
    },
  },
})
