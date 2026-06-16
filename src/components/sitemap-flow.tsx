import { useEffect, useState } from "react"
import type { ReactNode } from "react"
import { Flow } from "@cloudflare/kumo/components/flow"
import { Network } from "lucide-react"
import { getSitemapForDomain } from "@/server/brand-fns"
import type { SitemapNode, SitemapTree } from "@/lib/sitemap"

/**
 * Lazy-loaded sitemap section for the brand Overview tab. Fetches the domain's
 * sitemap (parsed server-side, no browser) and renders it as a Kumo Flow
 * diagram. Stays quiet — renders nothing — when a site has no discoverable
 * sitemap, so it never clutters the page.
 */
export function SitemapSection({ domain }: { domain: string }) {
  const [state, setState] = useState<
    | { status: "loading" }
    | { status: "error" }
    | { status: "done"; data: SitemapTree }
  >({ status: "loading" })

  useEffect(() => {
    let active = true
    setState({ status: "loading" })
    getSitemapForDomain({ data: domain })
      .then((data) => {
        if (active) setState({ status: "done", data })
      })
      .catch(() => {
        if (active) setState({ status: "error" })
      })
    return () => {
      active = false
    }
  }, [domain])

  // Nothing to show: no sitemap found, or it errored. Keep the page clean.
  if (state.status === "error") return null
  if (state.status === "done" && (!state.data.tree || state.data.total === 0))
    return null

  return (
    <section>
      <div className="mb-2.5 flex items-center justify-between">
        <h4 className="text-xs font-semibold tracking-wide text-kumo-subtle uppercase">
          Sitemap
        </h4>
        {state.status === "done" ? (
          <span className="tnum text-xs text-kumo-subtle">
            {state.data.total.toLocaleString()} URLs
          </span>
        ) : null}
      </div>

      {state.status === "loading" ? (
        <div className="grid min-h-40 place-items-center rounded-xl bg-kumo-tint ring-1 ring-kumo-hairline">
          <div className="flex flex-col items-center gap-2 text-kumo-subtle">
            <Network className="h-6 w-6 animate-pulse" strokeWidth={1.75} />
            <span className="text-sm">Mapping the site…</span>
          </div>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl bg-kumo-tint ring-1 ring-kumo-hairline">
          {/* canvas={false} disables Flow's pannable, motion-transformed
              wrapper — the sub-pixel transform makes node rects oscillate and
              triggers an infinite measure/setState loop. The connector lines
              are drawn in a separate overlay, so they still render. */}
          <Flow canvas={false} className="p-5">
            <Flow.Node>{state.data.tree!.label}</Flow.Node>
            {renderChildren(state.data.tree!)}
          </Flow>
        </div>
      )}
    </section>
  )
}

/** Render a node's children (plus a "+N more" node) inside a Flow.Parallel. */
function renderChildren(node: SitemapNode): ReactNode {
  const children = node.children ?? []
  if (children.length === 0 && !node.more) return null
  return (
    <Flow.Parallel>
      {children.map((child) => renderNode(child))}
      {node.more ? <MoreNode key="__more" count={node.more} /> : null}
    </Flow.Parallel>
  )
}

/** A branch (Flow.List: label + nested parallel) or a leaf (Flow.Node). */
function renderNode(node: SitemapNode): ReactNode {
  const hasChildren = (node.children?.length ?? 0) > 0 || Boolean(node.more)
  if (!hasChildren) return <Flow.Node key={node.path}>{node.label}</Flow.Node>
  return (
    <Flow.List key={node.path}>
      <Flow.Node>{node.label}</Flow.Node>
      {renderChildren(node)}
    </Flow.List>
  )
}

function MoreNode({ count }: { count: number }) {
  return (
    <Flow.Node
      render={
        <li className="rounded-lg border border-dashed border-kumo-line bg-transparent px-3 py-2 text-sm font-medium text-kumo-subtle">
          +{count} more
        </li>
      }
    />
  )
}
