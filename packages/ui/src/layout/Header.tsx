"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Logo } from "../branding/Logo";
import { ThemeToggle } from "../theme/ThemeToggle";
import { cn } from "@ugur/core";

const NAV_LINKS = [
  { href: "/about", label: "About" },
  { href: "/work", label: "Work" },
  { href: "/projects", label: "Projects" },
  { href: "/contact", label: "Contact" },
] as const;

export function Header() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => setMobileOpen(false), [pathname]);

  useEffect(() => {
    if (!mobileOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMobileOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [mobileOpen]);

  return (
    <header className={cn(
      "fixed inset-x-0 top-0 z-50 transition-all duration-500",
      scrolled
        ? "bg-background/80 backdrop-blur-md border-b-[0.5px] border-border/40 py-3 shadow-sm"
        : "bg-transparent border-transparent py-6"
    )}>
      {/* Container removed to use full page width with inner paddings */}
      <div className="flex items-center justify-between px-6 md:px-12 lg:px-24">
        {/* Logo left aligned */}
        <div className="flex-shrink-0">
          <Logo />
        </div>

        {/* Navigation and Actions right aligned */}
        <div className="flex items-center justify-end gap-6 md:gap-8 flex-1">
          <nav className="hidden md:flex items-center justify-end gap-8 font-mono text-sm uppercase tracking-widest mr-2" aria-label="Main navigation">
            {NAV_LINKS.map((l) => {
              const isActive = pathname?.startsWith(l.href);
              const itemClass = "group inline-flex flex-col items-start";
              const labelClass = "text-foreground/80 transition-colors duration-150 ease-in-out group-hover:text-foreground";
              const lineClass = cn(
                "block h-[1px] bg-foreground mt-1 transition-all duration-150",
                isActive ? "w-full" : "w-0 group-hover:w-full"
              );
              return (
                <Link
                  key={l.href}
                  href={l.href}
                  aria-current={isActive ? "page" : undefined}
                  className={itemClass}
                >
                  <span className={labelClass}>{l.label}</span>
                  <span className={lineClass} />
                </Link>
              );
            })}
          </nav>

          {/* Theme Toggle Button */}
          <ThemeToggle />

          <div className="md:hidden flex-shrink-0">
            <button
              type="button"
              aria-label={mobileOpen ? "Close menu" : "Open menu"}
              aria-expanded={mobileOpen}
              aria-controls="mobile-navigation"
              onClick={() => setMobileOpen((open) => !open)}
              className="p-2 transition-transform active:scale-95 text-foreground"
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="3" y1="12" x2="21" y2="12"></line>
                <line x1="3" y1="6" x2="21" y2="6"></line>
                <line x1="3" y1="18" x2="21" y2="18"></line>
              </svg>
            </button>
          </div>
        </div>
      </div>
      <nav
        id="mobile-navigation"
        aria-label="Mobile navigation"
        className={cn("md:hidden border-t border-border/50 bg-background px-6", mobileOpen ? "block" : "hidden")}
      >
        <ul className="mx-auto max-w-7xl divide-y divide-border/50 font-mono text-sm uppercase tracking-widest">
          {NAV_LINKS.map((link) => {
            const active = pathname?.startsWith(link.href);
            return (
              <li key={link.href}>
                <Link
                  href={link.href}
                  aria-current={active ? "page" : undefined}
                  onClick={() => setMobileOpen(false)}
                  className="block py-4 text-muted-foreground hover:text-foreground focus-visible:text-foreground"
                >
                  {link.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </header>
  );
}
