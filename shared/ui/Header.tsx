import Link from "next/link";

import { Container } from "@/shared/ui/Container";
import { Logo } from "@/shared/ui/Logo";

export function Header() {
  return (
    <header className="fixed inset-x-0 top-0 z-50 bg-background/80 backdrop-blur-md border-b border-border/40 transition-all duration-300">
      <Container className="flex items-center justify-between py-5 md:py-6">
        <div className="flex-shrink-0">
          <Logo />
        </div>
        <nav className="hidden md:flex flex-1 items-center justify-end gap-8 font-mono text-sm uppercase tracking-widest text-muted-foreground mr-8">
          <Link href="/about" className="hover:text-accent transition-colors duration-300">About</Link>
          <Link href="/work" className="hover:text-accent transition-colors duration-300">Work</Link>
          <Link href="/projects" className="hover:text-accent transition-colors duration-300">Projects</Link>
          <Link href="/blog" className="hover:text-accent transition-colors duration-300">Blog</Link>
          <Link href="/contact" className="hover:text-accent transition-colors duration-300">Contact</Link>
        </nav>
        <div className="md:hidden flex-shrink-0">
          <button aria-label="Open menu" className="p-2 transition-transform active:scale-95">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="3" y1="12" x2="21" y2="12"></line>
              <line x1="3" y1="6" x2="21" y2="6"></line>
              <line x1="3" y1="18" x2="21" y2="18"></line>
            </svg>
          </button>
        </div>
      </Container>
    </header>
  );
}
