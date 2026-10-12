import Link from "next/link";
import { SiteLogo } from "./SiteLogo";

const FOOTER_NAV = [
  { href: "/projects", label: "Projects" },
  { href: "/about", label: "About" },
  { href: "/education", label: "Education" },
  { href: "/blog", label: "Writing" },
  { href: "/contact", label: "Contact" },
] as const;

export function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-border bg-surface/40 py-10 text-foreground transition-colors md:py-14">
      <div className="site-container grid grid-cols-1 gap-8 sm:grid-cols-2 md:grid-cols-12 md:gap-8">
        <div className="md:col-span-4">
          <SiteLogo />
          <p className="mt-4 font-mono text-xs uppercase tracking-[0.12em] text-muted-foreground">
            Dortmund, Germany
          </p>
        </div>

        <nav aria-label="Footer navigation" className="md:col-span-4 md:col-start-6">
          <h2 className="font-mono text-xs uppercase tracking-widest text-muted-foreground">Explore</h2>
          <ul className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 font-mono text-xs uppercase tracking-wider">
            {FOOTER_NAV.map((item) => (
              <li key={item.href}>
                <Link href={item.href} className="inline-flex min-h-11 items-center text-foreground/80 transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <nav aria-label="Legal information" className="md:col-span-3 md:col-start-10">
          <h2 className="font-mono text-xs uppercase tracking-widest text-muted-foreground">Legal</h2>
          <ul className="mt-4 space-y-2 font-mono text-xs uppercase tracking-wider">
            <li><Link href="/imprint" className="inline-flex min-h-11 items-center text-foreground/80 transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">Imprint</Link></li>
            <li><Link href="/privacy" className="inline-flex min-h-11 items-center text-foreground/80 transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">Privacy policy</Link></li>
          </ul>
        </nav>

        <div className="border-t border-border/60 pt-5 font-mono text-[11px] uppercase tracking-wider text-muted-foreground sm:col-span-2 md:col-span-12">
          © {new Date().getFullYear()} Ugur Özdamar
        </div>
      </div>
    </footer>
  );
}

export default SiteFooter;
