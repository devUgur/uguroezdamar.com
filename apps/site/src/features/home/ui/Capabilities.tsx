const PILLARS = [
  {
    label: "Interface engineering",
    summary:
      "Accessible, responsive interfaces and coherent application flows — from Vue and Nuxt to React, Next.js and TypeScript.",
    disciplines: ["React / Next.js", "Vue / Nuxt", "TypeScript"],
  },
  {
    label: "APIs & data",
    summary:
      "The systems behind the UI: Node.js and Python services, REST APIs, authentication and practical data modeling.",
    disciplines: ["Node.js / Python", "REST APIs", "PostgreSQL"],
  },
  {
    label: "Infrastructure & delivery",
    summary:
      "Development environments and release workflows with Linux, CI pipelines, GitHub Actions, Docker and cloud infrastructure.",
    disciplines: ["Linux", "CI / CD", "Cloudflare"],
  },
] as const;

/** Editorial, static proof of engineering breadth; no client-side JavaScript. */
export function Capabilities({ number }: { number: string }) {
  return (
    <section id="capabilities" aria-labelledby="capabilities-heading" className="site-section bg-foreground text-background">
      <div className="site-container">
        <div className="grid gap-7 md:grid-cols-12 md:gap-8">
          <div className="md:col-span-4">
            <p className="font-mono text-xs uppercase tracking-[0.16em] text-background/70">
              {number} <span className="mx-2 text-background/30">/</span> Engineering scope
            </p>
          </div>
          <div className="md:col-span-8">
            <h2 id="capabilities-heading" className="max-w-3xl font-serif text-4xl leading-[1.12] tracking-tight sm:text-5xl lg:text-6xl">
              From interface to infrastructure.
            </h2>
            <p className="mt-6 max-w-2xl text-base leading-7 text-background/75 md:text-lg md:leading-8">
              I work across the layers of a product — how it feels, how data flows, and how it is shipped and maintained.
            </p>
          </div>
        </div>

        <ol className="mt-14 grid border-t border-background/25 md:mt-20 md:grid-cols-3">
          {PILLARS.map((pillar, index) => (
            <li
              key={pillar.label}
              className="border-b border-background/25 py-8 md:border-b-0 md:py-10 md:pr-8 md:[&:not(:first-child)]:border-l md:[&:not(:first-child)]:pl-8"
            >
              <p className="font-mono text-xs text-background/65">{String(index + 1).padStart(2, "0")}</p>
              <h3 className="mt-5 font-serif text-2xl leading-snug md:text-[1.7rem]">{pillar.label}</h3>
              <p className="mt-4 max-w-sm text-sm leading-7 text-background/75">{pillar.summary}</p>
              <ul aria-label={`Key technologies: ${pillar.label}`} className="mt-7 flex flex-wrap gap-2">
                {pillar.disciplines.map((discipline) => (
                  <li key={discipline} className="border border-background/25 px-2 py-1 font-mono text-[11px] text-background/80">
                    {discipline}
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
