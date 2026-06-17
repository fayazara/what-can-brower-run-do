import { createFileRoute } from "@tanstack/react-router"
import { z } from "zod"
import { browser } from "@/lib/browser"
import { guardUrl } from "@/lib/url-guard"
import { HOUR, cacheKey, readJsonCache, writeJsonCache } from "@/lib/cache"

/**
 * GET  /api/feed?url=...  → RSS 2.0 XML   (a real, subscribable feed URL)
 * POST /api/feed  { url } → RSS 2.0 XML   (same thing, for the demo form)
 *
 *   const { result } = await env.BROWSER.quickAction("json", {
 *     url,
 *     prompt: "Extract every article: title, link, date",
 *     response_format: { type: "json_schema", schema },
 *   })
 *
 * Browser Run renders the page and an AI model picks out the article list.
 * We then serialize it to RSS 2.0 so any reader can subscribe. Because this
 * is an actual feed URL, GET is the primary verb - paste it into your reader.
 * Incurs Workers AI usage; results are cached in KV for an hour.
 */

const inputSchema = z.object({
  url: z.string().url("Enter a valid http(s) URL"),
  // Optional channel title override; otherwise derived from the hostname.
  title: z.string().trim().min(1).max(120).optional(),
})

type Article = {
  title?: string
  url?: string
  link?: string
  date?: string
  summary?: string
}

type JsonResponse = {
  success?: boolean
  result?: { items?: Array<Article> } & Record<string, unknown>
  errors?: Array<{ message?: string }>
}

/**
 * JSON schema handed to the `json` quick action. We send both `schema` and
 * `json_schema` keys so it works regardless of which the binding expects
 * (mirrors the /api/extract route).
 */
const RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    items: {
      type: "array",
      items: {
        type: "object",
        properties: {
          title: { type: "string" },
          url: { type: "string" },
          date: { type: "string" },
          summary: { type: "string" },
        },
        required: ["title", "url"],
      },
    },
  },
  required: ["items"],
}

const EXTRACT_PROMPT =
  "Extract the list of articles, blog posts, or news stories shown on this " +
  "page. For each item return its title, the absolute URL it links to, the " +
  "publish date if one is shown, and a one-sentence summary if available. " +
  "Ignore navigation, ads, and footer links."

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;")
}

/** Resolve a possibly-relative href against the source page; drop junk. */
function absoluteUrl(href: string | undefined, base: string): string | null {
  if (!href) return null
  try {
    const u = new URL(href, base)
    if (u.protocol !== "http:" && u.protocol !== "https:") return null
    return u.toString()
  } catch {
    return null
  }
}

/** Best-effort parse of a date string into an RFC-822 pubDate. */
function toPubDate(raw: string | undefined): string | null {
  if (!raw) return null
  const t = Date.parse(raw)
  if (Number.isNaN(t)) return null
  return new Date(t).toUTCString()
}

function buildRss(opts: {
  channelTitle: string
  channelLink: string
  selfLink: string
  items: Array<Article>
}): string {
  const { channelTitle, channelLink, selfLink, items } = opts

  const seen = new Set<string>()
  const entries: Array<string> = []

  for (const item of items) {
    const link = absoluteUrl(item.url ?? item.link, channelLink)
    const title = (item.title ?? "").trim()
    if (!link || !title || seen.has(link)) continue
    seen.add(link)

    const parts = [
      `      <title>${escapeXml(title)}</title>`,
      `      <link>${escapeXml(link)}</link>`,
      `      <guid isPermaLink="true">${escapeXml(link)}</guid>`,
    ]
    const pubDate = toPubDate(item.date)
    if (pubDate) parts.push(`      <pubDate>${pubDate}</pubDate>`)
    const summary = (item.summary ?? "").trim()
    if (summary) {
      parts.push(`      <description>${escapeXml(summary)}</description>`)
    }
    entries.push(`    <item>\n${parts.join("\n")}\n    </item>`)
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXml(channelTitle)}</title>
    <link>${escapeXml(channelLink)}</link>
    <description>${escapeXml(`Feed generated from ${channelLink} by Browser Run`)}</description>
    <generator>Browser Run</generator>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <atom:link href="${escapeXml(selfLink)}" rel="self" type="application/rss+xml" />
${entries.join("\n")}
  </channel>
</rss>
`
}

type FeedResult =
  | { ok: true; xml: string; count: number; cache: "HIT" | "MISS" }
  | { ok: false; status: number; error: string }

/** Shared pipeline for both verbs: guard → cache → render → serialize. */
async function generateFeed(
  rawUrl: string,
  title: string | undefined,
  selfLink: string,
): Promise<FeedResult> {
  const guard = await guardUrl(rawUrl)
  if (!guard.ok) return { ok: false, status: guard.status, error: guard.reason }
  const url = guard.url

  const channelTitle = title ?? `${new URL(url).hostname} — feed`
  const key = cacheKey("feed", { url, title: channelTitle })

  const cached = await readJsonCache<{ xml: string; count: number }>(key)
  if (cached) {
    return { ok: true, xml: cached.xml, count: cached.count, cache: "HIT" }
  }

  const res = await browser.quickAction("json", {
    url,
    prompt: EXTRACT_PROMPT,
    response_format: {
      type: "json_schema",
      schema: RESPONSE_SCHEMA,
      json_schema: RESPONSE_SCHEMA,
    } as unknown as AiTextGenerationResponseFormat,
    gotoOptions: { waitUntil: "networkidle2", timeout: 30000 },
  })

  const data = (await res.json().catch(() => null)) as JsonResponse | null
  if (!res.ok || !data?.success || !data.result) {
    return {
      ok: false,
      status: 502,
      error: data?.errors?.[0]?.message ?? `Browser Run returned ${res.status}`,
    }
  }

  const items = Array.isArray(data.result.items) ? data.result.items : []
  const xml = buildRss({
    channelTitle,
    channelLink: url,
    selfLink,
    items,
  })
  // Count the items that actually made it into the feed.
  const count = (xml.match(/<item>/g) ?? []).length

  await writeJsonCache(key, { xml, count }, HOUR)
  return { ok: true, xml, count, cache: "MISS" }
}

function xmlResponse(xml: string, cache: "HIT" | "MISS"): Response {
  return new Response(xml, {
    headers: {
      "content-type": "application/rss+xml; charset=utf-8",
      "x-cache": cache,
    },
  })
}

export const Route = createFileRoute("/api/feed")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const reqUrl = new URL(request.url)
        const target = reqUrl.searchParams.get("url")
        if (!target) {
          return Response.json(
            { error: "Pass a page to turn into a feed: ?url=https://..." },
            { status: 400 },
          )
        }
        const parsed = inputSchema.safeParse({
          url: target,
          title: reqUrl.searchParams.get("title") ?? undefined,
        })
        if (!parsed.success) {
          return Response.json(
            { error: parsed.error.issues[0]?.message ?? "Invalid input" },
            { status: 400 },
          )
        }

        try {
          const feed = await generateFeed(
            parsed.data.url,
            parsed.data.title,
            reqUrl.toString(),
          )
          if (!feed.ok) {
            return Response.json({ error: feed.error }, { status: feed.status })
          }
          return xmlResponse(feed.xml, feed.cache)
        } catch (err) {
          return Response.json(
            {
              error:
                err instanceof Error ? err.message : "Feed generation failed",
            },
            { status: 500 },
          )
        }
      },

      POST: async ({ request }) => {
        let json: unknown
        try {
          json = await request.json()
        } catch {
          return Response.json({ error: "Invalid JSON" }, { status: 400 })
        }

        const parsed = inputSchema.safeParse(json)
        if (!parsed.success) {
          return Response.json(
            { error: parsed.error.issues[0]?.message ?? "Invalid input" },
            { status: 400 },
          )
        }

        // The shareable feed URL points at the GET endpoint.
        const reqUrl = new URL(request.url)
        const selfLink = `${reqUrl.origin}/api/feed?url=${encodeURIComponent(
          parsed.data.url,
        )}`

        try {
          const feed = await generateFeed(
            parsed.data.url,
            parsed.data.title,
            selfLink,
          )
          if (!feed.ok) {
            return Response.json({ error: feed.error }, { status: feed.status })
          }
          return xmlResponse(feed.xml, feed.cache)
        } catch (err) {
          return Response.json(
            {
              error:
                err instanceof Error ? err.message : "Feed generation failed",
            },
            { status: 500 },
          )
        }
      },
    },
  },
})
