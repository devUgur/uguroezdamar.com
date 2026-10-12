import Link from "next/link";
import { SiteLogo } from "./SiteLogo";

const FOOTER_LINKS = [
  { href: "/contact", label: "Contact" },
  { href: "/imprint", label: "Imprint" },
  { href: "/privacy", label: "Privacy" },
] as const;

export function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-border/60 py-6 text-foreground transition-colors md:py-8">
      <div className="site-container flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <SiteLogo compact size={28} />
          <p className="text-sm text-muted-foreground">
            © {new Date().getFullYear()} Ugur Özdamar
          </p>
        </div>

        <nav aria-label="Footer navigation">
          <ul className="flex flex-wrap items-center gap-x-7 text-sm">
            {FOOTER_LINKS.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="inline-flex min-h-11 items-center text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </footer>
  );
}

export default SiteFooter;
