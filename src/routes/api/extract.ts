import { createFileRoute } from "@tanstack/react-router"
import { z } from "zod"
import { browser } from "@/lib/browser"
import { guardUrl } from "@/lib/url-guard"
import { DAY, cacheKey, readJsonCache, writeJsonCache } from "@/lib/cache"

/**
 * POST /api/extract  → { url, prompt }  → { result }
 *
 *   await env.BROWSER.quickAction("json", { url, prompt })
 *
 * Renders the page and uses an AI model (Workers AI by default) to extract
 * structured data described by the prompt. Incurs Workers AI usage.
 */
const bodySchema = z.object({
  url: z.string().url("Enter a valid http(s) URL"),
  prompt: z
    .string()
    .trim()
    .min(1, "Describe what to extract")
    .max(500, "Keep the prompt under 500 characters"),
  // Optional list of field names. When provided we build a JSON schema and
  // pass it as `response_format`, which makes extraction far more reliable
  // (prompt-only mode often fails with "Unable to form JSON...").
  fields: z.array(z.string().trim().min(1).max(40)).max(12).optional(),
})

/**
 * Build a Browser Run `response_format` from a flat list of field names:
 * an object with a `results` array of objects with those fields.
 *
 * The /json docs use a `schema` key; the generated binding type uses
 * `json_schema`. We send both so it works regardless, and cast to satisfy TS.
 */
function buildResponseFormat(fields: Array<string>) {
  const properties: Record<string, { type: string }> = {}
  for (const f of fields) properties[f] = { type: "string" }
  const schema = {
    type: "object",
    properties: {
      results: {
        type: "array",
        items: {
          type: "object",
          properties,
          required: fields.slice(0, 1),
        },
      },
    },
    required: ["results"],
  }
  return { type: "json_schema", schema, json_schema: schema }
}

type JsonResponse = {
  success?: boolean
  result?: Record<string, unknown>
  errors?: Array<{ message?: string }>
  rawAiResponse?: string
}

export const Route = createFileRoute("/api/extract")({
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

        const { prompt, fields } = parsed.data

        const guard = await guardUrl(parsed.data.url)
        if (!guard.ok) {
          return Response.json({ error: guard.reason }, { status: guard.status })
        }
        const url = guard.url
        const key = cacheKey("extract", { url, prompt, fields: fields ?? [] })

        const cached = await readJsonCache(key)
        if (cached) {
          return Response.json(cached, { headers: { "x-cache": "HIT" } })
        }

        try {
          const res = await browser.quickAction("json", {
            url,
            prompt,
            ...(fields && fields.length > 0
              ? {
                  response_format:
                    buildResponseFormat(fields) as unknown as AiTextGenerationResponseFormat,
                }
              : {}),
            gotoOptions: { waitUntil: "networkidle2", timeout: 30000 },
          })

          const data = (await res.json().catch(() => null)) as JsonResponse | null

          if (!res.ok || !data?.success || !data.result) {
            return Response.json(
              {
                error:
                  data?.errors?.[0]?.message ??
                  `Browser Run returned ${res.status}`,
              },
              { status: 502 },
            )
          }

          const payload = { result: data.result }
          await writeJsonCache(key, payload, DAY)
          return Response.json(payload, { headers: { "x-cache": "MISS" } })
        } catch (err) {
          return Response.json(
            { error: err instanceof Error ? err.message : "Extraction failed" },
            { status: 500 },
          )
        }
      },
    },
  },
})
