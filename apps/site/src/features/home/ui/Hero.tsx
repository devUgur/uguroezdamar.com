import Link from "next/link";
import { type Locale } from "@/src/features/navigation";

const HEADLINE_EN = ["I build", "digital products –", "from concept to operation."] as const;
const HEADLINE_DE = ["Ich entwickle", "digitale Produkte –", "von der Idee bis zum Betrieb."] as const;

const TECH_TAGS = [
  "TypeScript",
  "React & Next.js",
  "PostgreSQL",
  "Backend & APIs",
  "Cloud & DevOps",
] as const;

export function Hero({ locale = "en" }: { locale?: Locale }) {
  const german = locale === "de";
  const headline = german ? HEADLINE_DE : HEADLINE_EN;

  return (
    <section className="hero-surface site-container flex min-h-[calc(100svh-5rem)] flex-col">
      <div className="flex flex-1 flex-col justify-center py-12 md:py-16">
        <p className="mb-4 font-mono text-xs uppercase tracking-[0.16em] text-muted-foreground sm:text-sm">
          {german ? "Full-Stack Software Engineer · Dortmund" : "Full-Stack Software Engineer · Dortmund"}
        </p>

        <h1 className="max-w-[15ch] text-[clamp(2.25rem,6.8vw,4.25rem)] leading-[1.12] tracking-tighter md:text-[4rem] lg:text-[clamp(4rem,min(6vw,9.5vh),5.25rem)]">
          {headline.map((line) => (
            <span key={line} className="hero-title-line block cursor-default">
              {line}
            </span>
          ))}
        </h1>

        <p className="mt-6 max-w-2xl text-base leading-7 text-muted-foreground md:text-lg md:leading-8">
          {german
            ? "Ich konzipiere und entwickle Webanwendungen mit TypeScript, React, Next.js und PostgreSQL. Mein Schwerpunkt liegt auf durchdachten Architekturen, sicheren APIs, automatisierten Tests und skalierbaren SaaS-Systemen."
            : "I design and build web applications with TypeScript, React, Next.js, and PostgreSQL. Focused on thoughtful architectures, secure APIs, automated testing, and scalable SaaS systems."}
        </p>

        <div className="mt-7 flex flex-wrap items-center gap-2 font-mono text-xs">
          {TECH_TAGS.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center rounded-xs border border-border/80 bg-background/50 px-2.5 py-1 text-foreground/85 transition-colors"
            >
              {tag}
            </span>
          ))}
        </div>

        <div className="mt-8 flex flex-wrap items-center gap-x-8 gap-y-3 font-mono text-[13px] uppercase tracking-[0.08em]">
          <Link
            href={locale === "de" ? "/de/projects" : "/projects"}
            className="inline-flex min-h-11 items-center gap-3 border border-foreground/80 px-5 text-foreground transition-colors hover:bg-foreground hover:text-background focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
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
