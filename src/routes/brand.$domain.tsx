import { useState } from "react"
import { Link, createFileRoute } from "@tanstack/react-router"
import { Breadcrumbs } from "@cloudflare/kumo/components/breadcrumbs"
import { CodeHighlighted } from "@cloudflare/kumo/code"
import {
  ChevronLeft,
  Download,
  ExternalLink,
  FileCode2,
  Palette,
  Zap,
} from "lucide-react"
import { PageHeader } from "@/components/kumo/page-header/page-header"
import { BrandLogo, BrandOverview } from "@/components/brand-card"
import { SitemapSection } from "@/components/sitemap-flow"
import { getBrandForDomain } from "@/server/brand-fns"

export const Route = createFileRoute("/brand/$domain")({
  loader: ({ params }) => getBrandForDomain({ data: params.domain }),
  component: BrandPermalink,
  errorComponent: BrandError,
})

function BrandPermalink() {
  const { domain, url, brand, cached, designMd } = Route.useLoaderData()
  const [tab, setTab] = useState<"overview" | "design">("overview")

  return (
    <div className="mx-auto w-full max-w-4xl px-5 py-7 sm:py-10">
      <div className="enter" style={{ animationDelay: "0ms" }}>
        <Link
          to="/$slug"
          params={{ slug: "brand" }}
          className="group -ml-2 inline-flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm font-medium text-kumo-subtle transition-[color,scale] hover:text-kumo-default active:scale-[0.96]"
        >
          <ChevronLeft className="h-4 w-4 transition-transform duration-200 group-hover:-translate-x-0.5" />
          Brand extractor
        </Link>
      </div>

      {/* Identity strip */}
      <header
        className="enter mt-4 flex items-start gap-4"
        style={{ animationDelay: "40ms" }}
      >
        <BrandLogo
          brand={brand}
          className="img-outline h-14 w-14 shrink-0 rounded-xl bg-kumo-tint object-contain p-1.5"
        />
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-2xl font-semibold tracking-tight text-kumo-default">
            {brand.name ?? domain}
          </h1>
          <a
            href={url}
            target="_blank"
            rel="noreferrer noopener"
            className="mt-0.5 inline-flex items-center gap-1 text-sm text-kumo-subtle transition-colors hover:text-kumo-default"
          >
            {domain}
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </div>
        <span
          className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${
            cached
              ? "bg-emerald-100 text-emerald-700"
              : "bg-violet-100 text-violet-700"
          }`}
          title={
            cached
              ? "Served instantly from Workers KV"
              : "Freshly extracted via Browser Run"
          }
        >
          {cached ? (
            <Zap className="h-3.5 w-3.5" />
          ) : (
            <Palette className="h-3.5 w-3.5" />
          )}
          {cached ? "Cached" : "Fresh"}
        </span>
      </header>

      <div className="enter mt-6" style={{ animationDelay: "80ms" }}>
        <PageHeader
          breadcrumbs={
            <Breadcrumbs>
              <Breadcrumbs.Link href="/">Home</Breadcrumbs.Link>
              <Breadcrumbs.Separator />
              <Breadcrumbs.Link href="/brand">Brand</Breadcrumbs.Link>
              <Breadcrumbs.Separator />
              <Breadcrumbs.Current>{domain}</Breadcrumbs.Current>
            </Breadcrumbs>
          }
          tabs={[
            { label: "Overview", value: "overview" },
            { label: "DESIGN.md", value: "design" },
          ]}
          defaultTab={tab}
          onValueChange={(v) => setTab(v === "design" ? "design" : "overview")}
        />
      </div>

      <section className="enter mt-6" style={{ animationDelay: "120ms" }}>
        {tab === "overview" ? (
          <div className="flex flex-col gap-6">
            <BrandOverview brand={brand} />
            <SitemapSection domain={domain} />
          </div>
        ) : (
          <DesignMdTab designMd={designMd} domain={domain} />
        )}
      </section>
    </div>
  )
}

function DesignMdTab({
  designMd,
  domain,
}: {
  designMd: string
  domain: string
}) {
  function download() {
    const blob = new Blob([designMd], { type: "text/markdown" })
    const href = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = href
    a.download = "DESIGN.md"
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(href)
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-start justify-between gap-4">
        <p className="max-w-prose text-sm leading-relaxed text-kumo-subtle">
          An agent-ready{" "}
          <a
            href="https://github.com/google-labs-code/design.md"
            target="_blank"
            rel="noreferrer noopener"
            className="font-medium text-kumo-default underline decoration-kumo-line underline-offset-2 hover:decoration-kumo-default"
          >
            DESIGN.md
          </a>{" "}
          for <span className="font-medium text-kumo-default">{domain}</span> —
          YAML design tokens plus prose a coding agent can read to match this
          brand. Copy it into your repo or paste it into your tool.
        </p>
        <button
          type="button"
          onClick={download}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-kumo-base px-3 py-2 text-sm font-medium text-kumo-default ring-1 ring-kumo-line transition-[transform,box-shadow] hover:shadow-sm active:scale-[0.96]"
        >
          <Download className="h-4 w-4" />
          Download
        </button>
      </div>

      <div className="overflow-hidden rounded-xl ring-1 ring-kumo-hairline">
        <div className="flex items-center gap-2 border-b border-kumo-hairline bg-kumo-tint px-3.5 py-2 text-xs font-medium text-kumo-subtle">
          <FileCode2 className="h-3.5 w-3.5 shrink-0" strokeWidth={2} />
          DESIGN.md
        </div>
        <CodeHighlighted
          code={designMd}
          lang="markdown"
          showCopyButton
          className="!rounded-none !border-0 text-[13px]"
        />
      </div>
    </div>
  )
}

function BrandError({ error }: { error: Error }) {
  return (
    <div className="mx-auto flex max-w-2xl flex-col items-center gap-3 px-5 py-24 text-center">
      <Palette className="h-8 w-8 text-kumo-subtle" strokeWidth={1.75} />
      <h1 className="text-xl font-semibold tracking-tight text-kumo-default">
        Couldn&apos;t build that brand page
      </h1>
      <p className="max-w-md text-sm text-kumo-subtle">
        {error.message || "Something went wrong while reading the site."}
      </p>
      <Link
        to="/$slug"
        params={{ slug: "brand" }}
        className="mt-2 rounded-xl bg-stone-900 px-4 py-2.5 text-sm font-medium text-white transition-transform active:scale-[0.96]"
      >
        Try another site
      </Link>
    </div>
  )
}
