import Link from "next/link";
import GitHubIcon from "@/shared/ui/icons/GitHubIcon";
import LinkedInIcon from "@/shared/ui/icons/LinkedInIcon";

import { Container } from "@/shared/ui/Container";

export function Footer() {
  return (
    <footer className="border-t border-zinc-200 py-8 mt-16">
      <Container className="flex flex-col items-center justify-between gap-4 sm:flex-row">
        <div className="flex items-center gap-3">
          <span className="text-sm text-zinc-700">© 2026 Ugur Dev</span>
        </div>

        <nav className="flex items-center gap-4">
          <Link
            href="https://github.com/devUgur"
            className="flex items-center gap-2 text-sm text-zinc-700 hover:text-zinc-900"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Ugur on GitHub"
          >
            <GitHubIcon className="h-5 w-5" />
            <span className="hidden sm:inline">GitHub</span>
          </Link>

          <Link
            href="https://www.linkedin.com/in/uguroezdamar"
            className="flex items-center gap-2 text-sm text-zinc-700 hover:text-zinc-900"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Ugur on LinkedIn"
          >
            <LinkedInIcon className="h-5 w-5" />
            <span className="hidden sm:inline">LinkedIn</span>
          </Link>
        </nav>
      </Container>
    </footer>
  );
}
