import Link from "next/link";
import { type Locale } from "@/src/features/navigation";

const HEADLINE = ["I build", "structured", "digital systems."] as const;

export function Hero({ locale = "en" }: { locale?: Locale }) {
  const german = locale === "de";
  const headline = german ? ["Ich entwickle", "strukturierte", "digitale Systeme."] : HEADLINE;
  return (
    <section className="site-container flex min-h-[calc(100svh-5rem)] flex-col">
      <div className="flex flex-1 flex-col justify-center py-14 md:py-16">
        <h1 className="text-[clamp(2.5rem,12.8vw,3.5rem)] leading-[1.1] tracking-tighter md:text-[5rem] lg:text-[clamp(5rem,min(8.4vw,13.5vh),7.5rem)]">
          {headline.map((line) => (
            <span key={line} className="block cursor-default transition-colors duration-200 hover:text-accent">
              {line}
            </span>
          ))}
        </h1>

        <p className="mt-8 flex items-center gap-x-4 font-mono text-[13px] tracking-wide text-foreground sm:text-sm">
          <span>{german ? "Full-Stack-Entwickler" : "Full-stack developer"}</span>
          <span aria-hidden="true" className="h-px w-4 shrink-0 bg-border" />
          <span>
            Dortmund<span className="hidden sm:inline">, {german ? "Deutschland" : "Germany"}</span>
          </span>
        </p>

        <p className="mt-5 max-w-xl text-base leading-7 text-muted-foreground md:text-lg md:leading-8">
          {german ? "Ich konzipiere und entwickle Webanwendungen ganzheitlich: React- und TypeScript-Oberflächen, die zugehörigen APIs und Datenmodelle sowie den zuverlässigen Betrieb." : "I design and build web applications end to end: React and TypeScript interfaces, the APIs and data models behind them, and the deployment that keeps them running."}
        </p>

        <div className="mt-8 flex flex-wrap items-center gap-x-8 gap-y-3 font-mono text-[13px] uppercase tracking-[0.08em]">
          <Link
            href={locale === "de" ? "/de/projects" : "/projects"}
            className="inline-flex min-h-11 items-center gap-3 rounded-sm border border-foreground/80 px-5 text-foreground transition-colors hover:bg-foreground hover:text-background focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
          >
            {german ? "Projekte ansehen" : "View projects"}
          </Link>
          <Link
            href={locale === "de" ? "/de/contact" : "/contact"}
            className="inline-flex min-h-11 items-center gap-2 text-foreground/75 underline-offset-8 transition-colors hover:text-foreground hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
          >
            {german ? "Kontakt aufnehmen" : "Get in touch"} <span aria-hidden="true">→</span>
          </Link>
        </div>
      </div>

      <div
        aria-hidden="true"
        className="hidden items-center gap-4 pb-10 font-mono text-[11px] uppercase tracking-widest text-muted-foreground [@media(min-height:700px)]:flex"
      >
        <span>{german ? "Weiter scrollen" : "Scroll to explore"}</span>
        <span className="relative block h-px w-12 overflow-hidden bg-border">
          <span className="scroll-cue absolute inset-0 bg-foreground" />
        </span>
      </div>
    </section>
  );
}

export default Hero;
