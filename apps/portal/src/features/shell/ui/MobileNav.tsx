import Link from "next/link";
import { ThemeToggle } from "@ugur/ui";

const LINKS = [
  { href: "/", label: "Dashboard" },
  { href: "/agents", label: "Agenten" },
  { href: "/work", label: "Aufgaben" },
  { href: "/usage", label: "Verbrauch" },
  { href: "/costs", label: "Kosten" },
  { href: "/organization", label: "Organisation" },
  { href: "/projects", label: "Repositories" },
  { href: "/portfolio", label: "Portfolio" },
  { href: "/models", label: "Modelle" },
  { href: "/chat", label: "Chat" },
  { href: "/admin/team", label: "Team" },
];

/** Navigation below the md breakpoint, where the sidebar would leave no room for the page. */
export function MobileNav() {
  return (
    <header className="flex items-center gap-2 border-b border-border bg-card px-3 py-2 md:hidden">
      <nav aria-label="Hauptnavigation" className="flex min-w-0 flex-1 gap-1 overflow-x-auto">
        {LINKS.map((link) => (
          <Link key={link.href} href={link.href} className="shrink-0 rounded-md px-3 py-2 text-sm hover:bg-accent">
            {link.label}
          </Link>
        ))}
      </nav>
      <ThemeToggle />
      <form action="/api/auth/logout" method="post">
        <button type="submit" className="rounded-md px-3 py-2 text-sm hover:bg-destructive/10 hover:text-destructive">
          Logout
        </button>
      </form>
    </header>
  );
}
