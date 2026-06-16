import {
  Camera,
  ReceiptText,
  FileText,
  Palette,
  Layers,
  Crosshair,
  Braces,
  Link2,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"

/**
 * The catalogue of "things Browser Run can do" that this app showcases.
 *
 * Each entry powers a card on the home page AND the header of its demo
 * page, so adding a new showcase is a one-stop edit: drop an entry here,
 * add the matching route under `src/routes/`, and an API route under
 * `src/routes/api/`.
 */
export type UseCase = {
  /** URL slug, also the route path: `/{slug}`. */
  slug: string
  /** Big, fun, verb-first title. */
  title: string
  /** One-liner shown on the home card. */
  tagline: string
  /** Longer blurb shown on the demo page. */
  blurb: string
  /** lucide-react icon. */
  icon: LucideIcon
  /** Tailwind classes for the card's accent (icon chip + glow). */
  accent: {
    /** background of the icon chip */
    chip: string
    /** text colour of the icon */
    icon: string
    /** subtle ring/border on hover */
    ring: string
  }
  /** The one-line Browser Run call this demo boils down to. */
  snippet: string
}

export const useCases: Array<UseCase> = [
  {
    slug: "screenshot",
    title: "Screenshot any webpage",
    tagline: "Paste a URL, get a pixel-perfect picture of the live page.",
    blurb:
      "Browser Run spins up a real headless Chromium, loads the page, waits for it to render, and hands you back a PNG. No browser to install, no servers to babysit.",
    icon: Camera,
    accent: {
      chip: "bg-orange-100",
      icon: "text-orange-600",
      ring: "hover:ring-orange-200",
    },
    snippet: `await env.BROWSER.quickAction("screenshot", {
  url: "https://cloudflare.com",
})`,
  },
  {
    slug: "receipt",
    title: "Print a receipt to PDF",
    tagline: "Fill a tiny form, get a crisp, printable PDF receipt.",
    blurb:
      "Hand Browser Run some HTML and it renders a real PDF - perfect for invoices, receipts, tickets and certificates. We build the HTML on the server and stream the PDF straight back.",
    icon: ReceiptText,
    accent: {
      chip: "bg-emerald-100",
      icon: "text-emerald-600",
      ring: "hover:ring-emerald-200",
    },
    snippet: `await env.BROWSER.quickAction("pdf", {
  html: receiptHtml,
})`,
  },
  {
    slug: "read",
    title: "Turn a page into Markdown",
    tagline: "Strip the ads and chrome - keep the readable content.",
    blurb:
      "Browser Run renders the page, then converts the meaningful content into clean Markdown. Great for feeding pages to LLMs, building reading views, or archiving articles.",
    icon: FileText,
    accent: {
      chip: "bg-sky-100",
      icon: "text-sky-600",
      ring: "hover:ring-sky-200",
    },
    snippet: `await env.BROWSER.quickAction("markdown", {
  url: "https://blog.cloudflare.com",
})`,
  },
  {
    slug: "brand",
    title: "Extract a brand kit",
    tagline: "Give it a URL, get logo, colors and fonts back as JSON.",
    blurb:
      "Puppeteer drives a real browser and reads the logo, computed colors and font families straight from the DOM - no AI guesswork. setBypassCSP lets it work even on strict-CSP sites like GitHub and Stripe. Results are cached in Workers KV, so a repeat lookup is instant.",
    icon: Palette,
    accent: {
      chip: "bg-violet-100",
      icon: "text-violet-600",
      ring: "hover:ring-violet-200",
    },
    snippet: `const browser = await puppeteer.launch(env.BROWSER)
const page = await browser.newPage()
await page.setBypassCSP(true)
await page.goto(url, { waitUntil: "networkidle2" })
const brand = await page.evaluate(readBrandFromDOM)`,
  },
  {
    slug: "snapshot",
    title: "Snapshot a page",
    tagline: "Rendered HTML and a screenshot, in a single call.",
    blurb:
      "The snapshot action returns both the fully-rendered HTML and a screenshot of the page in one request - handy for archiving, audits, or diffing how a page changes over time.",
    icon: Layers,
    accent: {
      chip: "bg-amber-100",
      icon: "text-amber-600",
      ring: "hover:ring-amber-200",
    },
    snippet: `await env.BROWSER.quickAction("snapshot", {
  url: "https://example.com",
})`,
  },
  {
    slug: "scrape",
    title: "Scrape elements",
    tagline: "Pull specific elements off a page with a CSS selector.",
    blurb:
      "Point the scrape action at any CSS selector and get back every matching element - its text, inner HTML, size, and attributes. Great for grabbing headlines, prices, or links.",
    icon: Crosshair,
    accent: {
      chip: "bg-rose-100",
      icon: "text-rose-600",
      ring: "hover:ring-rose-200",
    },
    snippet: `await env.BROWSER.quickAction("scrape", {
  url,
  elements: [{ selector: ".titleline > a" }],
})`,
  },
  {
    slug: "extract",
    title: "Extract structured data",
    tagline: "Describe what you want, get clean JSON back via AI.",
    blurb:
      "The json action renders the page and uses an AI model to extract exactly the structured data you ask for - listings, prices, article metadata. Best for facts that live in the readable text.",
    icon: Braces,
    accent: {
      chip: "bg-indigo-100",
      icon: "text-indigo-600",
      ring: "hover:ring-indigo-200",
    },
    snippet: `await env.BROWSER.quickAction("json", {
  url,
  prompt: "Extract the products",
  response_format: { type: "json_schema", schema },
})`,
  },
  {
    slug: "links",
    title: "Get every link",
    tagline: "Pull all the links off a page - internal or external.",
    blurb:
      "The links action returns every URL on the page. Filter to just visible links or just internal ones - useful for sitemaps, link audits, and building your own crawlers.",
    icon: Link2,
    accent: {
      chip: "bg-teal-100",
      icon: "text-teal-600",
      ring: "hover:ring-teal-200",
    },
    snippet: `await env.BROWSER.quickAction("links", {
  url,
  excludeExternalLinks: true,
})`,
  },
]

export function getUseCase(slug: string): UseCase | undefined {
  return useCases.find((u) => u.slug === slug)
}
