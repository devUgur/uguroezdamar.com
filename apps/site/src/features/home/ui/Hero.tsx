import Link from "next/link";

export function Hero() {
  return (
    <section className="site-container grid min-h-[min(760px,calc(100svh-5rem))] grid-cols-1 items-end gap-12 pb-20 pt-36 md:min-h-[min(820px,calc(100svh-5rem))] md:grid-cols-12 md:gap-8 md:pb-28 md:pt-44">
      <div className="md:col-span-9">
        <p className="mb-8 font-mono text-xs uppercase tracking-[0.18em] text-muted-foreground md:text-sm">
          01 <span className="mx-2 text-border">/</span> Software development · Dortmund
        </p>
        <h1 className="max-w-[1000px] text-[clamp(3rem,8.3vw,7.5rem)] leading-[0.98] tracking-[-0.055em]">
          From interface to infrastructure.
        </h1>
        <p className="mt-8 max-w-2xl text-base leading-7 text-muted-foreground md:mt-10 md:text-xl md:leading-8">
          Full-stack software development across user-facing interfaces and the systems behind them.
        </p>
        <div className="mt-10 flex flex-wrap items-center gap-x-8 gap-y-4 font-mono text-xs uppercase tracking-[0.14em] md:mt-12 md:text-sm">
          <Link href="#work" className="link-underline inline-flex min-h-11 items-center gap-3 text-foreground focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring">
            Selected work <span aria-hidden="true">↘</span>
          </Link>
          <Link href="/contact" className="link-underline inline-flex min-h-11 items-center gap-3 text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring">
            Get in touch <span aria-hidden="true">↗</span>
          </Link>
        </div>
      </div>
      <p className="border-t border-border pt-4 font-mono text-[11px] uppercase leading-6 tracking-[0.12em] text-muted-foreground md:col-span-3 md:col-start-10 md:justify-self-end md:border-l md:border-t-0 md:pl-5 md:pt-0">
        Ugur Özdamar<br />
        Software developer<br />
        Dortmund, Germany
      </p>
    </section>
  );
}

export default Hero;
