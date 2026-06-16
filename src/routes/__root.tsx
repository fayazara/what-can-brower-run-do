import {
  HeadContent,
  Outlet,
  Scripts,
  createRootRoute,
} from "@tanstack/react-router"
import { ShikiProvider } from "@cloudflare/kumo/code"
import appCss from "../styles.css?url"

const TITLE = "What can Browser Run do?"
const DESCRIPTION =
  "A playful tour of Cloudflare Browser Run - screenshots, PDFs, and Markdown, each rendered by a real headless browser at the edge."

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:image", content: "/browser-run.webp" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:image", content: "/browser-run.webp" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", href: "https://www.cloudflare.com/favicon.ico" },
    ],
  }),
  shellComponent: RootDocument,
  component: RootLayout,
})

function RootLayout() {
  return (
    <ShikiProvider
      engine="javascript"
      languages={["tsx", "typescript", "json", "bash", "html", "markdown"]}
    >
      <div className="flex min-h-svh flex-col bg-kumo-canvas">
        <main className="flex-1">
          <Outlet />
        </main>
        <SiteFooter />
      </div>
    </ShikiProvider>
  )
}

function SiteFooter() {
  return (
    <footer className="border-t border-kumo-hairline">
      <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-2 px-5 py-6 text-sm text-kumo-subtle sm:flex-row">
        <p>
          Built on Cloudflare Workers + TanStack Start. Every render here runs
          on a real headless browser.
        </p>
        <a
          href="https://github.com"
          target="_blank"
          rel="noreferrer"
          className="font-medium text-kumo-subtle transition-colors hover:text-kumo-default"
        >
          Open source ↗
        </a>
      </div>
    </footer>
  )
}

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  )
}
