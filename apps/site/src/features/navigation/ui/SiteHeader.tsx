"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { ThemeToggle } from "@ugur/ui/client";
import { cn } from "@ugur/core";
import { SiteLogo } from "./SiteLogo";

const NAV_LINKS = [
  { href: "/projects", label: "Projects" },
  { href: "/about", label: "About" },
  { href: "/education", label: "Education" },
  { href: "/blog", label: "Writing" },
  { href: "/contact", label: "Contact" },
] as const;

export function SiteHeader() {
  const pathname = usePathname();
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
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:rounded-md focus:bg-foreground focus:px-4 focus:py-2 focus:text-xs focus:font-mono focus:uppercase focus:tracking-wider focus:text-background focus:shadow-lg focus:outline-none focus:ring-2 focus:ring-accent"
      >
        Skip to main content
      </a>

      <header
        className={cn(
          "fixed inset-x-0 top-0 z-40 transition-all duration-300",
          scrolled
            ? "border-b border-border/60 bg-background/90 py-3 backdrop-blur-md shadow-xs"
            : "border-b border-transparent bg-background/60 py-5 backdrop-blur-xs",
        )}
      >
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 sm:px-8 lg:px-12">
          <SiteLogo />

          <div className="flex items-center gap-6 sm:gap-8">
            <nav
              className="hidden lg:flex items-center gap-5 xl:gap-7 font-mono text-[11px] uppercase tracking-widest"
              aria-label="Main navigation"
            >
              {NAV_LINKS.map((item) => {
                const isActive = pathname?.startsWith(item.href);

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={isActive ? "page" : undefined}
                  className="group relative inline-flex min-h-11 flex-col justify-center py-1 text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 rounded-xs"
                  >
                    <span className={cn(isActive && "text-foreground font-medium")}>
                      {item.label}
                    </span>
                    <span
                      aria-hidden="true"
                      className={cn(
                        "mt-1 block h-[1px] bg-foreground transition-all duration-200",
                        isActive ? "w-full" : "w-0 group-hover:w-full",
                      )}
                    />
                  </Link>
                );
              })}
            </nav>

            <div className="flex items-center gap-2">
              <ThemeToggle />

              <div className="lg:hidden">
                <button
                  type="button"
                  aria-label={mobileOpen ? "Close navigation menu" : "Open navigation menu"}
                  aria-expanded={mobileOpen}
                  aria-controls="mobile-navigation"
                  onClick={() => setMobileOpen((open) => !open)}
                  className="inline-flex h-11 w-11 items-center justify-center rounded-md border border-border/80 text-foreground transition-colors hover:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                >
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
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
                        <line x1="4" y1="7" x2="20" y2="7" />
                        <line x1="4" y1="12" x2="20" y2="12" />
                        <line x1="4" y1="17" x2="20" y2="17" />
                      </>
                    )}
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>

        <nav
          id="mobile-navigation"
          aria-label="Mobile navigation"
          className={cn(
            "lg:hidden border-t border-border/60 bg-background/98 backdrop-blur-lg px-6 py-4 shadow-lg transition-all duration-200",
            mobileOpen ? "block" : "hidden",
          )}
        >
          <ul className="mx-auto max-w-7xl divide-y divide-border/40 font-mono text-xs uppercase tracking-widest">
            {NAV_LINKS.map((item) => {
              const isActive = pathname?.startsWith(item.href);

              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={isActive ? "page" : undefined}
                    onClick={() => setMobileOpen(false)}
                    className={cn(
                      "block min-h-11 py-3.5 transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
                      isActive
                        ? "text-foreground font-semibold"
                        : "text-muted-foreground",
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
