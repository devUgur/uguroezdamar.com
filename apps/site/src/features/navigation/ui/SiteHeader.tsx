"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { ThemeToggle } from "@ugur/ui/client";
import { cn } from "@ugur/core";
import { SiteLogo } from "./SiteLogo";
import { copy, getLocale, localizedPath } from "../copy";

export function SiteHeader() {
  const pathname = usePathname();
  const locale = getLocale(pathname);
  const text = copy[locale];
  const base = locale === "de" ? "/de" : "";
  const navLinks = [
    { href: `${base}/projects`, label: text.nav[0] },
    { href: `${base}/${locale === "de" ? "about" : "about"}`, label: text.nav[1] },
    { href: `${base}/contact`, label: text.nav[2] },
  ];
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 16);
    };
    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!mobileOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMobileOpen(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [mobileOpen]);

  return (
    <>
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:rounded-md focus:bg-foreground focus:px-4 focus:py-2 focus:text-sm focus:text-background focus:shadow-lg focus:outline-2 focus:outline-offset-2 focus:outline-ring"
      >
        {text.skip}
      </a>

      <header
        className={cn(
          "fixed inset-x-0 top-0 z-40 border-b transition-[background-color,border-color,padding] duration-300",
          mobileOpen
            ? "border-border/50 bg-background py-3"
            : scrolled
              ? "border-border/50 bg-background/90 py-3 backdrop-blur-md"
              : "border-transparent bg-transparent py-5",
        )}
      >
        <div className="site-container flex items-center justify-between">
          <SiteLogo locale={locale} />

          <div className="flex items-center gap-3 md:gap-8">
            <nav
              className="hidden items-center gap-8 font-mono text-[13px] uppercase tracking-[0.08em] md:flex"
              aria-label={text.mainNav}
            >
              {navLinks.map((item) => {
                const isActive = pathname === item.href || pathname?.startsWith(`${item.href}/`);

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={isActive ? "page" : undefined}
                    className="group relative inline-flex min-h-11 flex-col justify-center rounded-xs focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
                  >
                    <span
                      className={cn(
                        "transition-colors duration-150 group-hover:text-foreground",
                        isActive ? "text-foreground" : "text-foreground/75",
                      )}
                    >
                      {item.label}
                    </span>
                    <span
                      aria-hidden="true"
                      className={cn(
                        "absolute bottom-2 left-0 block h-px bg-foreground transition-all duration-150",
                        isActive ? "w-full" : "w-0 group-hover:w-full",
                      )}
                    />
                  </Link>
                );
              })}
            </nav>

            <div className="flex items-center gap-1">
              <Link href={localizedPath(pathname ?? "/", locale === "en" ? "de" : "en")} hrefLang={locale === "en" ? "de" : "en"} lang={locale === "en" ? "de" : "en"} className="inline-flex min-h-11 items-center rounded-xs px-2 font-mono text-[11px] uppercase tracking-wider text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring" aria-label={`${text.language}: ${text.switchLanguage}`}>
                {locale === "en" ? "DE" : "EN"}
              </Link>
              <ThemeToggle />

              <button
                type="button"
                aria-label={mobileOpen ? text.closeMenu : text.openMenu}
                aria-expanded={mobileOpen}
                aria-controls="mobile-navigation"
                onClick={() => setMobileOpen((open) => !open)}
                className="-mr-2.5 inline-flex h-11 w-11 items-center justify-center rounded-md text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring md:hidden"
              >
                <svg
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.75"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  {mobileOpen ? (
                    <>
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </>
                  ) : (
                    <>
                      <line x1="3" y1="7" x2="21" y2="7" />
                      <line x1="3" y1="12" x2="21" y2="12" />
                      <line x1="3" y1="17" x2="21" y2="17" />
                    </>
                  )}
                </svg>
              </button>
            </div>
          </div>
        </div>

        <nav
          id="mobile-navigation"
          aria-label={text.mainNav}
          className={cn("md:hidden", mobileOpen ? "block" : "hidden")}
        >
          <ul className="site-container pb-6 pt-4">
            {navLinks.map((item) => {
              const isActive = pathname === item.href || pathname?.startsWith(`${item.href}/`);

              return (
                <li key={item.href} className="border-t border-border/50 first:border-t-0">
                  <Link
                    href={item.href}
                    aria-current={isActive ? "page" : undefined}
                    onClick={() => setMobileOpen(false)}
                    className={cn(
                      "flex min-h-14 items-center font-serif text-2xl tracking-tight transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                      isActive ? "text-foreground" : "text-foreground/75",
                    )}
                  >
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </header>
    </>
  );
}

export default SiteHeader;
