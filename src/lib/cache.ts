import { env } from "cloudflare:workers"

/**
 * Tiny caching layer over the `CACHE` KV namespace. Browser Run calls (and the
 * Workers AI extraction) are relatively expensive, so on a public demo we cache
 * results keyed by their inputs. Repeat requests for the same URL come straight
 * from KV - cheaper, faster, and abuse-resistant.
 *
 * Bump CACHE_VERSION to invalidate every cached entry at once.
 */
const CACHE_VERSION = "v1"

export const HOUR = 60 * 60
export const DAY = HOUR * 24

/** Build a stable cache key from a namespace and an ordered set of params. */
export function cacheKey(ns: string, params: Record<string, unknown>): string {
  const norm = Object.keys(params)
    .sort()
    .map((k) => `${k}=${JSON.stringify(params[k])}`)
    .join("&")
  return `${ns}:${CACHE_VERSION}:${norm}`
}

export async function readJsonCache<T>(key: string): Promise<T | null> {
  try {
    return (await env.CACHE.get(key, "json")) as T | null
  } catch {
    return null
  }
}

export async function writeJsonCache(
  key: string,
  value: unknown,
  ttlSeconds: number,
): Promise<void> {
  try {
    await env.CACHE.put(key, JSON.stringify(value), {
      expirationTtl: ttlSeconds,
    })
  } catch {
    // Cache writes are best-effort; never fail the request over them.
  }
}

type BinaryHit = { body: ArrayBuffer; contentType: string }

export async function readBinaryCache(key: string): Promise<BinaryHit | null> {
  try {
    const { value, metadata } = await env.CACHE.getWithMetadata<{
      contentType?: string
    }>(key, "arrayBuffer")
    if (!value) return null
    return {
      body: value,
      contentType: metadata?.contentType ?? "application/octet-stream",
    }
  } catch {
    return null
  }
}

export async function writeBinaryCache(
  key: string,
  body: ArrayBuffer,
  contentType: string,
  ttlSeconds: number,
): Promise<void> {
  try {
    await env.CACHE.put(key, body, {
      expirationTtl: ttlSeconds,
      metadata: { contentType },
    })
  } catch {
    // best-effort
  }
}
