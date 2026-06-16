import { createFileRoute, Link } from "@tanstack/react-router"
import { useCases } from "@/lib/use-cases"

export const Route = createFileRoute("/")({
  component: Home,
})

function Home() {
  return (
    <div className="mx-auto w-full max-w-5xl px-5 py-12 sm:py-20">
      {/* Hero */}
      <div className="mx-auto max-w-2xl text-center">
        <h1
          className="enter mt-5 text-4xl font-semibold tracking-tight text-kumo-default sm:text-5xl"
          style={{ animationDelay: "0ms" }}
        >
          What can{" "}
          <span className="bg-linear-to-r from-orange-500 to-amber-500 bg-clip-text text-transparent">
            Browser Run
          </span>{" "}
          do?
        </h1>

        <p
          className="enter mx-auto mt-4 max-w-xl text-[17px] leading-relaxed text-kumo-subtle"
          style={{ animationDelay: "60ms" }}
        >
          A real headless browser, one function call away. Pick a trick below
          and watch Cloudflare&apos;s network render it for you - live.
        </p>

        <div className="enter mt-10" style={{ animationDelay: "120ms" }}>
          <video
            src="/browser-running-2.mp4"
            autoPlay
            loop
            muted
            playsInline
            className="mx-auto h-32"
          ></video>
        </div>
      </div>

      {/* Use-case grid */}
      <div className="mt-12 grid gap-4 sm:mt-16 sm:grid-cols-2 lg:grid-cols-3">
        {useCases.map((uc, i) => {
          const Icon = uc.icon
          return (
            <Link
              key={uc.slug}
              to="/$slug"
              params={{ slug: uc.slug }}
              className={`enter group relative flex flex-col rounded-xl bg-kumo-base p-5 ring ring-kumo-hairline transition-[transform,box-shadow] duration-200 ease-[cubic-bezier(0.2,0,0,1)] hover:-translate-y-0.5 hover:shadow-md hover:ring-kumo-line active:scale-[0.99]`}
              style={{ animationDelay: `${180 + i * 40}ms` }}
            >
              <span
                className={`flex h-11 w-11 items-center justify-center rounded-md ${uc.accent.chip}`}
              >
                <Icon
                  className={`h-[22px] w-[22px] ${uc.accent.icon}`}
                  strokeWidth={2}
                />
              </span>

              <h2 className="mt-4 text-[17px] font-semibold tracking-tight text-kumo-default">
                {uc.title}
              </h2>
              <p className="mt-1.5 flex-1 text-sm leading-relaxed text-kumo-subtle">
                {uc.tagline}
              </p>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
