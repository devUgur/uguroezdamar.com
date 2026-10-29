import Link from "next/link";
import { SiteLogo } from "./SiteLogo";
import { copy, type Locale } from "../copy";

export function SiteFooter({ locale = "en" }: { locale?: Locale }) {
  const text = copy[locale];
  const base = locale === "de" ? "/de" : "";
  const footerLinks = [
    { href: `${base}/contact`, label: text.contact },
    { href: `${base}/imprint`, label: text.imprint },
    { href: `${base}/privacy`, label: text.privacy },
  ];
  return (
    <footer className="mt-auto border-t border-border/60 py-6 text-foreground transition-colors md:py-8">
      <div className="site-container flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <SiteLogo compact size={28} locale={locale} />
          <p className="text-sm text-muted-foreground">
            © {new Date().getFullYear()} Ugur Özdamar
          </p>
        </div>

        <nav aria-label={text.footerNav}>
          <ul className="flex flex-wrap items-center gap-x-7 text-sm">
            {footerLinks.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="inline-flex min-h-11 items-center text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                >
                  {item.label}
                </Link>
              </li>
            ))}
            <li key="github">
              <a
                href="https://github.com/devUgur"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-11 items-center gap-1 text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              >
                GitHub
                <span aria-hidden="true" className="text-xs">↗</span>
              </a>
            </li>
          </ul>
        </nav>
      </div>
    </footer>
  );
}

export default SiteFooter;
