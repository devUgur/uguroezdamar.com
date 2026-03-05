"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { ThemeToggle } from "@ugur/ui";
import { cn } from "@ugur/core";
import { SiteLogo } from "./SiteLogo";

const links = [
  { href: "/about", label: "About" },
  { href: "/work", label: "Work" },
  { href: "/projects", label: "Projects" },
  { href: "/contact", label: "Contact" },
];

export function SiteHeader() {
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 16);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-50 transition-all duration-300",
        scrolled
          ? "bg-background/90 backdrop-blur-md border-b border-border/50 py-3"
          : "bg-background/70 backdrop-blur-sm border-b border-transparent py-4",
      )}
    >
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-10">
        <SiteLogo />

        <div className="flex items-center gap-5">
          <nav className="hidden md:flex items-center gap-6 font-mono text-xs uppercase tracking-widest">
            {links.map((link) => {
              const active = pathname?.startsWith(link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  aria-current={active ? "page" : undefined}
                  className="group inline-flex flex-col items-start"
                >
                  <span className="text-muted-foreground transition-colors duration-150 ease-in-out group-hover:text-foreground">
                    {link.label}
                  </span>
                  <span
                    className={cn(
                      "block h-[1px] bg-foreground mt-1 transition-all duration-150",
                      active ? "w-full" : "w-0 group-hover:w-full",
                    )}
                  />
                </Link>
              );
            })}
          </nav>

          <ThemeToggle />

          <div className="md:hidden flex-shrink-0">
            <button aria-label="Open menu" className="p-2 transition-transform active:scale-95 text-foreground">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="3" y1="12" x2="21" y2="12"></line>
                <line x1="3" y1="6" x2="21" y2="6"></line>
                <line x1="3" y1="18" x2="21" y2="18"></line>
              </svg>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}

export default SiteHeader;
