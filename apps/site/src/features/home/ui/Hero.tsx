import Link from "next/link";

const HEADLINE = ["I build", "structured", "digital systems."] as const;

const ENGINEERING_LAYERS = [
  { number: "01", label: "Interfaces", detail: "React, Next.js, Vue and Nuxt" },
  { number: "02", label: "Systems", detail: "APIs, services and data models" },
  { number: "03", label: "Delivery", detail: "CI/CD, Linux and cloud infrastructure" },
] as const;

export function Hero() {
  return (
    <section className="site-container flex min-h-[calc(100svh-5rem)] flex-col">
      <div className="grid flex-1 items-center gap-12 py-14 md:py-16 xl:grid-cols-[minmax(0,1.85fr)_minmax(14rem,0.65fr)] xl:gap-14">
        <div className="min-w-0">
          <h1 className="text-[clamp(2.5rem,12.8vw,3.5rem)] leading-[1.1] tracking-tighter md:text-[5rem] xl:text-[clamp(5.5rem,7vw,6.75rem)]">
            {HEADLINE.map((line) => (
              <span key={line} className="block cursor-default transition-colors duration-200 hover:text-accent">
                {line}
              </span>
            ))}
          </h1>

          <p className="mt-8 flex flex-wrap items-center gap-x-4 gap-y-2 font-mono text-[13px] tracking-wide text-foreground sm:text-sm">
            <span>Full-stack developer</span>
            <span aria-hidden="true" className="h-px w-4 shrink-0 bg-border" />
            <span>Dortmund, Germany</span>
          </p>

          <p className="mt-5 max-w-xl text-base leading-7 text-muted-foreground md:text-lg md:leading-8">
            I build web applications end to end — from thoughtful interfaces and reliable APIs
            to databases and the infrastructure that keeps products running.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-x-8 gap-y-3 font-mono text-[13px] uppercase tracking-[0.08em]">
            <Link
              href="/projects"
              className="inline-flex min-h-11 items-center gap-3 rounded-sm border border-foreground/80 px-5 text-foreground transition-colors hover:bg-foreground hover:text-background focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
            >
              Explore projects
            </Link>
            <Link
              href="/contact"
              className="inline-flex min-h-11 items-center gap-2 text-foreground/75 underline-offset-8 transition-colors hover:text-foreground hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
            >
              Get in touch <span aria-hidden="true">→</span>
            </Link>
          </div>
        </div>

        <aside className="hidden border-l border-border pl-8 xl:block" aria-label="Areas of software engineering">
          <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
            Engineering / In practice
          </p>
          <ol className="mt-5 border-t border-border">
            {ENGINEERING_LAYERS.map((layer) => (
              <li key={layer.number} className="border-b border-border py-5">
                <p className="font-mono text-[11px] text-muted-foreground">{layer.number}</p>
                <h2 className="mt-2 font-serif text-2xl leading-snug">{layer.label}</h2>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{layer.detail}</p>
              </li>
            ))}
          </ol>
        </aside>
      </div>

      <div
        aria-hidden="true"
        className="hidden items-center gap-4 pb-10 font-mono text-[11px] uppercase tracking-widest text-muted-foreground [@media(min-height:700px)]:flex"
      >
        <span>Scroll to explore</span>
        <span className="relative block h-px w-12 overflow-hidden bg-border">
          <span className="scroll-cue absolute inset-0 bg-foreground" />
        </span>
      </div>
    </section>
  );
}

export default Hero;
