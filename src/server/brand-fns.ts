import { createServerFn } from "@tanstack/react-start"
import { desc } from "drizzle-orm"
import type { BrandKit } from "@/lib/brand"
import { db } from "@/db"
import { brandPages } from "@/db/schema"
import { extractBrand, hostFor } from "@/lib/brand"
import { toDesignMd } from "@/lib/design-md"
import { getSitemap } from "@/lib/sitemap"
import type { SitemapTree } from "@/lib/sitemap"

/**
 * Server functions (typed RPCs) for the brand feature. These are safe to import
 * from client components — TanStack Start moves the handler bodies (and their
 * server-only imports like `@/db` and `@/lib/brand`) into the server bundle.
 */

export type BrandPageData = {
  domain: string
  url: string
  brand: BrandKit
  cached: boolean
  designMd: string
}

/**
 * Resolve a domain to its brand kit + DESIGN.md. Runs the full extraction
 * pipeline on a cache miss (so hitting /brand/<new-domain> just works), then
 * returns everything the permalink page needs.
 */
export const getBrandForDomain = createServerFn({ method: "GET" })
  .inputValidator((domain: string) => domain)
  .handler(async ({ data: domain }): Promise<BrandPageData> => {
    const host = hostFor(domain.includes("://") ? domain : `https://${domain}`)
    const url = `https://${host}`
    const { brand, cached } = await extractBrand(url)
    const designMd = toDesignMd(brand, { domain: host, sourceUrl: url })
    return { domain: host, url, brand, cached, designMd }
  })

export type RecentBrand = {
  domain: string
  name: string | null
  logoUrl: string | null
  hitCount: number
}

/** Parse a domain's sitemap into a capped tree for the Flow diagram. */
export const getSitemapForDomain = createServerFn({ method: "GET" })
  .inputValidator((domain: string) => domain)
  .handler(async ({ data: domain }): Promise<SitemapTree> => {
    const host = hostFor(domain.includes("://") ? domain : `https://${domain}`)
    return await getSitemap(host)
  })

/** The public directory: most-recently generated brand pages. */
export const listRecentBrands = createServerFn({ method: "GET" }).handler(
  async (): Promise<Array<RecentBrand>> => {
    return await db
      .select({
        domain: brandPages.domain,
        name: brandPages.name,
        logoUrl: brandPages.logoUrl,
        hitCount: brandPages.hitCount,
      })
      .from(brandPages)
      .orderBy(desc(brandPages.updatedAt))
      .limit(12)
  },
)
