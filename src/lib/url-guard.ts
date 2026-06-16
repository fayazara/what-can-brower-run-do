import { DAY, cacheKey, readJsonCache, writeJsonCache } from "@/lib/cache"

/**
 * Safety guard for user-supplied URLs that get rendered by Browser Run on a
 * public demo. Two layers:
 *
 *   1. Structural (cheap, local) — only allow public http(s) URLs. Block
 *      non-http schemes, localhost, private network ranges, link-local and
 *      cloud-metadata IPs (basic SSRF hygiene).
 *   2. Content (category-based) — instead of a hand-maintained porn denylist,
 *      we ask Cloudflare for Families (the 1.1.1.3 resolver) over DNS-over-HTTPS
 *      whether the host is in a blocked category. Blocked domains resolve to
 *      0.0.0.0 with an Extended DNS Error "EDE(17): Filtered". This catches
 *      innocent-looking domains and avoids false positives like "essex.gov.uk".
 *
 * Verdicts are cached in KV per-host so we only hit the resolver once a day.
 */

// Cloudflare for Families - blocks malware + adult content.
// (Use security.cloudflare-dns.com for malware-only.)
const FAMILY_DOH = "https://family.cloudflare-dns.com/dns-query"

function isPrivateHost(hostname: string): boolean {
  const h = hostname.toLowerCase().replace(/\.$/, "")
  if (h === "localhost" || h.endsWith(".localhost")) return true
  if (h.endsWith(".local") || h.endsWith(".internal")) return true
  // IPv6 loopback / unique-local / link-local
  if (h === "::1" || h === "::") return true
  if (h.startsWith("fe80:") || h.startsWith("fc") || h.startsWith("fd")) {
    return true
  }
  // IPv4 literal ranges
  const m = h.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/)
  if (m) {
    const a = Number(m[1])
    const b = Number(m[2])
    if (a === 0 || a === 127) return true // 0.0.0.0/8, 127/8 loopback
    if (a === 10) return true // 10/8
    if (a === 192 && b === 168) return true // 192.168/16
    if (a === 172 && b >= 16 && b <= 31) return true // 172.16/12
    if (a === 169 && b === 254) return true // 169.254/16 link-local + metadata
    if (a === 100 && b >= 64 && b <= 127) return true // 100.64/10 CGNAT
  }
  return false
}

function isIpLiteral(hostname: string): boolean {
  return /^\d{1,3}(\.\d{1,3}){3}$/.test(hostname) || hostname.includes(":")
}

type DohJson = {
  Answer?: Array<{ data?: string }>
  Comment?: Array<string> | string
}

/**
 * Ask Cloudflare for Families whether a hostname is in a blocked category.
 * Fails *open* (returns false) on any network/parse error - this is a decency
 * filter, not a security control, and we don't want transient DNS hiccups to
 * take the demo down. SSRF/structural checks are handled separately.
 */
async function isCategoryBlocked(hostname: string): Promise<boolean> {
  const key = cacheKey("guard:dns", { host: hostname })
  const cached = await readJsonCache<{ blocked: boolean }>(key)
  if (cached) return cached.blocked

  try {
    const res = await fetch(
      `${FAMILY_DOH}?name=${encodeURIComponent(hostname)}&type=A`,
      { headers: { accept: "application/dns-json" } },
    )
    if (!res.ok) return false
    const data = (await res.json()) as DohJson
    const comment = Array.isArray(data.Comment)
      ? data.Comment.join(" ")
      : (data.Comment ?? "")
    const blocked =
      (data.Answer?.some((a) => a.data === "0.0.0.0" || a.data === "::") ??
        false) || /EDE\(17\)/i.test(comment)

    await writeJsonCache(key, { blocked }, DAY)
    return blocked
  } catch {
    return false // fail open
  }
}

export type GuardResult =
  | { ok: true; url: string }
  | { ok: false; status: number; reason: string }

/**
 * Validate and screen a user-supplied URL. Returns the normalized URL on
 * success, or a status + human-readable reason to return to the caller.
 */
export async function guardUrl(rawUrl: string): Promise<GuardResult> {
  let u: URL
  try {
    u = new URL(rawUrl)
  } catch {
    return { ok: false, status: 400, reason: "Enter a valid URL" }
  }

  if (u.protocol !== "http:" && u.protocol !== "https:") {
    return {
      ok: false,
      status: 400,
      reason: "Only http(s) URLs are supported",
    }
  }

  const host = u.hostname.toLowerCase()
  if (isPrivateHost(host)) {
    return {
      ok: false,
      status: 400,
      reason: "Local and private network addresses aren't allowed",
    }
  }

  // DNS category check only applies to real hostnames, not bare IPs.
  if (!isIpLiteral(host) && (await isCategoryBlocked(host))) {
    return {
      ok: false,
      status: 451,
      reason: "This site is blocked by the content filter",
    }
  }

  return { ok: true, url: u.toString() }
}
