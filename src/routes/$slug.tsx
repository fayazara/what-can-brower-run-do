import { createFileRoute, notFound } from "@tanstack/react-router"
import type { ComponentType } from "react"
import { getUseCase } from "@/lib/use-cases"
import { DemoPage } from "@/components/demo-page"
import { ScreenshotDemo } from "@/components/demos/screenshot-demo"
import { ReceiptDemo } from "@/components/demos/receipt-demo"
import { ReadDemo } from "@/components/demos/read-demo"
import { BrandDemo } from "@/components/demos/brand-demo"
import { SnapshotDemo } from "@/components/demos/snapshot-demo"
import { ScrapeDemo } from "@/components/demos/scrape-demo"
import { ExtractDemo } from "@/components/demos/extract-demo"
import { LinksDemo } from "@/components/demos/links-demo"
import { FeedDemo } from "@/components/demos/feed-demo"

/** Maps each use-case slug to its interactive demo component. */
const DEMOS: Record<string, ComponentType> = {
  screenshot: ScreenshotDemo,
  receipt: ReceiptDemo,
  read: ReadDemo,
  brand: BrandDemo,
  snapshot: SnapshotDemo,
  scrape: ScrapeDemo,
  extract: ExtractDemo,
  links: LinksDemo,
  feed: FeedDemo,
}

export const Route = createFileRoute("/$slug")({
  loader: ({ params }) => {
    const useCase = getUseCase(params.slug)
    if (!useCase) throw notFound()
    return { slug: useCase.slug }
  },
  component: DemoRoute,
  notFoundComponent: NotFound,
})

function DemoRoute() {
  const { slug } = Route.useParams()
  const useCase = getUseCase(slug)
  if (!useCase) return <NotFound />

  const Demo = DEMOS[slug] ?? null

  return <DemoPage useCase={useCase}>{Demo ? <Demo /> : null}</DemoPage>
}

function NotFound() {
  return (
    <div className="mx-auto flex max-w-5xl flex-col items-center gap-3 px-5 py-24 text-center">
      <h1 className="text-2xl font-semibold tracking-tight text-stone-900">
        That trick doesn&apos;t exist yet
      </h1>
      <p className="text-stone-600">
        Head back home to see what Browser Run can do.
      </p>
      <a
        href="/"
        className="mt-2 rounded-xl bg-stone-900 px-4 py-2.5 text-sm font-medium text-white transition-transform active:scale-[0.96]"
      >
        Back to all use cases
      </a>
    </div>
  )
}
