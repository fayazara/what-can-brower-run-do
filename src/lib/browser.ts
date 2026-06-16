import { env } from "cloudflare:workers"

/**
 * The Browser Run binding, declared in `wrangler.jsonc` as `BROWSER`.
 *
 * Server-only. `cloudflare:workers` is a virtual module - never import this
 * from anything that runs in the browser. Use it inside API route handlers
 * or server functions.
 *
 * Call quick actions with `browser.quickAction("screenshot" | "pdf" |
 * "markdown" | ..., options)`. Each returns a `Response`:
 *   - screenshot / pdf  → binary body (image/png, application/pdf)
 *   - markdown / content → JSON body: `{ success, result, meta }`
 *
 * Heads up for local dev: quick actions require `"remote": true` on the
 * browser binding (already set), so they run against the real headless
 * browser over Cloudflare's network.
 */
export const browser = env.BROWSER
