import { sql } from "drizzle-orm"
import { int, sqliteTable, text } from "drizzle-orm/sqlite-core"
import { createInsertSchema, createSelectSchema } from "drizzle-zod"
import type { z } from "zod"

/**
 * Example `items` table.
 *
 * After editing this file:
 *   1. `npm run db:generate` - creates SQL in ./drizzle
 *   2. `npm run db:migrate`  - applies it to local D1
 *   3. `npm run db:migrate:prod` - applies it to remote D1
 */
export const items = sqliteTable("items", {
  id: int("id").primaryKey({ autoIncrement: true }),
  title: text("title").notNull(),
  description: text("description"),
  createdAt: int("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
})

export type Item = typeof items.$inferSelect
export type NewItem = typeof items.$inferInsert

/**
 * `brand_pages` — the public directory of shareable brand pages.
 *
 * Every time a brand kit is extracted (via the demo or a /brand/{domain}
 * permalink) we upsert a row here keyed by host. This powers the
 * "recently generated" directory and lets us show a hit count without
 * re-running the (expensive) browser pipeline. The actual brand kit JSON
 * still lives in Workers KV — this table is just a lightweight index.
 */
export const brandPages = sqliteTable("brand_pages", {
  /** Bare host, e.g. "cloudflare.com" — the canonical /brand/{domain} key. */
  domain: text("domain").primaryKey(),
  /** Display name from the extracted kit (best-effort). */
  name: text("name"),
  /** Logo URL from the extracted kit (best-effort, for the directory thumb). */
  logoUrl: text("logo_url"),
  /** How many times this domain has been generated/viewed-with-extract. */
  hitCount: int("hit_count").notNull().default(1),
  createdAt: int("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
  updatedAt: int("updated_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
})

export type BrandPage = typeof brandPages.$inferSelect
export type NewBrandPage = typeof brandPages.$inferInsert

// Zod schemas derived from the drizzle table.
// `insertItemSchema` is what the POST /api/items handler validates against.
export const selectItemSchema = createSelectSchema(items)
export const insertItemSchema = createInsertSchema(items, {
  title: (schema) => schema.min(1).max(200),
  description: (schema) => schema.max(2000).nullish(),
}).pick({ title: true, description: true })

export type InsertItemInput = z.infer<typeof insertItemSchema>
