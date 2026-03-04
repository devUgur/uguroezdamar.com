"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Logo } from "./Logo";
import { ThemeToggle } from "./ThemeToggle";
import { cn } from "@/shared/lib/utils";

export function Header() {
  const [scrolled, setScrolled] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

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
          <nav className="hidden md:flex items-center justify-end gap-8 font-mono text-sm uppercase tracking-widest mr-2">
            {[
              { href: "/about", label: "About" },
              { href: "/work", label: "Work" },
              { href: "/projects", label: "Projects" },
              { href: "/blog", label: "Blog" },
              { href: "/contact", label: "Contact" },
            ].map((l) => {
              const isActive = pathname?.startsWith(l.href);
              return (
                <Link
                  key={l.href}
                  href={l.href}
                  aria-current={isActive ? "page" : undefined}
                  className="group inline-flex flex-col items-start"
                >
                  <span className="text-muted-foreground transition-colors duration-150 ease-in-out group-hover:text-foreground">
                    {l.label}
                  </span>
                  <span
                    className={cn(
                      "block h-[1px] bg-foreground mt-1 transition-all duration-150",
                      isActive ? "w-full" : "w-0 group-hover:w-full"
                    )}
                  />
                </Link>
              );
            })}
          </nav>

          {/* Theme Toggle Button */}
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
