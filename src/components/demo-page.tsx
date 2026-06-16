import type { ReactNode } from "react"
import { Link } from "@tanstack/react-router"
import { ChevronLeft, FileCode2 } from "lucide-react"
import { CodeHighlighted } from "@cloudflare/kumo/code"
import { LayerCard } from "@cloudflare/kumo/components/layer-card"
import type { UseCase } from "@/lib/use-cases"

/**
 * Shared chrome for every demo page: back link, a compact icon + title header,
 * a LayerCard editor strip showing the Browser Run snippet + the API endpoint
 * it maps to, then the interactive demo below it.
 *
 * Single column and intentionally compact. Surfaces use Kumo's neutral tokens
 * (canvas → elevated → base) so it matches the Cloudflare dashboard. Content
 * eases in as staggered chunks rather than popping in all at once.
 */
export function DemoPage({
  useCase,
  children,
}: {
  useCase: UseCase
  children: ReactNode
}) {
  const Icon = useCase.icon
  const endpoint = `/api/${useCase.slug}`

  return (
    <div className="mx-auto w-full max-w-4xl px-5 py-7 sm:py-10">
      <div className="enter" style={{ animationDelay: "0ms" }}>
        <Link
          to="/"
          className="group -ml-2 inline-flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm font-medium text-kumo-subtle transition-[color,scale] hover:text-kumo-default active:scale-[0.96]"
        >
          <ChevronLeft className="h-4 w-4 transition-transform duration-200 group-hover:-translate-x-0.5" />
          All use cases
        </Link>
      </div>

      <header
        className="enter mt-4 flex items-center gap-3"
        style={{ animationDelay: "40ms" }}
      >
        <span
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg shadow-sm ring-1 ring-black/5 ${useCase.accent.chip}`}
        >
          <Icon className={`h-5 w-5 ${useCase.accent.icon}`} strokeWidth={2} />
        </span>
        <h1 className="text-xl font-semibold tracking-tight text-balance text-kumo-default sm:text-2xl">
          {useCase.title}
        </h1>
      </header>

      <p
        className="enter mt-3 max-w-2xl text-sm leading-relaxed text-pretty text-kumo-subtle"
        style={{ animationDelay: "80ms" }}
      >
        {useCase.blurb}
      </p>

      {/* Editor strip: LayerCard tray with a labelled header + the snippet. */}
      <LayerCard className="enter mt-5" style={{ animationDelay: "120ms" }}>
        <LayerCard.Secondary className="justify-between">
          <span className="flex items-center gap-2 text-xs font-medium">
            <FileCode2 className="h-3.5 w-3.5 shrink-0" strokeWidth={2} />
            {useCase.slug}.ts
          </span>
          <span className="inline-flex items-center gap-1.5 rounded bg-kumo-base px-1.5 py-0.5 text-[11px] font-semibold ring ring-kumo-fill">
            <span className="text-emerald-600">POST</span>
            <span className="font-mono text-kumo-subtle">{endpoint}</span>
          </span>
        </LayerCard.Secondary>
        <LayerCard.Primary className="!p-0">
          <CodeHighlighted
            code={useCase.snippet}
            lang="tsx"
            showCopyButton
            showLineNumbers
            className="!rounded-none !border-0 !bg-transparent text-[13px]"
          />
        </LayerCard.Primary>
      </LayerCard>

      <p
        className="enter mt-2.5 text-[13px] leading-relaxed text-pretty text-kumo-subtle"
        style={{ animationDelay: "160ms" }}
      >
        No API tokens, no browser to install. The{" "}
        <code className="rounded bg-kumo-fill px-1 py-0.5 font-mono text-[12px] text-kumo-default">
          BROWSER
        </code>{" "}
        binding talks to a real Chromium over Cloudflare&apos;s network.
      </p>

      <section className="enter mt-6" style={{ animationDelay: "200ms" }}>
        {children}
      </section>
    </div>
  )
}
