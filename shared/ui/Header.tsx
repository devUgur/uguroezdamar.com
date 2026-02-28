import Link from "next/link";

import { Container } from "@/shared/ui/Container";

export function Header() {
  return (
    <header className="border-b border-zinc-200">
      <Container className="flex items-center justify-between py-4">
        <Link href="/" className="text-sm font-semibold">
          Ugur Özdamar
        </Link>
        <nav className="flex items-center gap-4 text-sm">
          <Link href="/about" className="text-zinc-700 hover:text-zinc-900">
            About
          </Link>
          <Link href="/work" className="text-zinc-700 hover:text-zinc-900">
            Work
          </Link>
          <Link href="/education" className="text-zinc-700 hover:text-zinc-900">
            Education
          </Link>
          <Link href="/projects" className="text-zinc-700 hover:text-zinc-900">
            Projects
          </Link>
          <Link href="/blog" className="text-zinc-700 hover:text-zinc-900">
            Blog
          </Link>
          <Link href="/contact" className="text-zinc-700 hover:text-zinc-900">
            Contact
          </Link>
        </nav>
      </Container>
    </header>
  );
}
