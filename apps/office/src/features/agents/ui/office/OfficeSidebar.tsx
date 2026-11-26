import Link from "next/link";
import { cn } from "@ugur/core";
import { ThemeToggle } from "@ugur/ui";
import type { OfficeScope, ThreadProject } from "../../types";

interface OfficeSidebarProps {
  projects: ThreadProject[];
  /** Current scope; undefined on pages that have none (the chat list). */
  scope?: OfficeScope;
  /** The chat pages are open. */
  chatsActive?: boolean;
  /** Origin of the admin portal of the same stage: settings live there. */
  portalUrl: string;
}

const PORTAL_LINKS = [
  { path: "/work", label: "Aufgaben" },
  { path: "/usage", label: "Verbrauch & Kosten" },
  { path: "/projects", label: "Repositories" },
  { path: "/models", label: "Modelle" },
  { path: "/organization", label: "Organisation" },
];

const itemClass = "flex shrink-0 items-baseline justify-between gap-2 rounded-md px-3 py-2 text-sm transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

function NavLink({ href, active, label, hint }: { href: string; active: boolean; label: string; hint?: string }) {
  return (
    <Link href={href} aria-current={active ? "page" : undefined} className={cn(itemClass, active && "bg-accent font-medium")}>
      <span className="truncate">{label}</span>
      {hint ? <span className="text-xs text-muted-foreground">{hint}</span> : null}
    </Link>
  );
}

/**
 * Left navigation of the office: the scope first (company, then each project as an inner layer), then the chats,
 * then the way into the portal. The scope travels as ?project= and every chat opened from the room inherits it.
 */
export function OfficeSidebar({ projects, scope, chatsActive = false, portalUrl }: OfficeSidebarProps) {
  return (
    <aside className="flex shrink-0 flex-col gap-4 border-b border-border bg-card p-3 md:h-full md:w-60 md:border-b-0 md:border-r md:p-4">
      <div className="flex items-center justify-between gap-2">
        <Link href="/" className="font-serif text-xl">
          Office
        </Link>
        <ThemeToggle />
      </div>

      <nav aria-label="Bereich" className="flex gap-1 overflow-x-auto md:flex-col md:overflow-visible">
        <p className="hidden px-3 pb-1 text-xs uppercase tracking-wider text-muted-foreground md:block">Bereich</p>
        <NavLink href="/" active={scope === null} label="Firma" hint="alle" />
        {projects.map((project) => (
          <NavLink
            key={project.id}
            href={`/?project=${encodeURIComponent(project.id)}`}
            active={scope === project.id}
            label={project.name}
            hint={project.visibility === "private" ? "privat" : undefined}
          />
        ))}
        <p className="hidden px-3 pb-1 pt-3 text-xs uppercase tracking-wider text-muted-foreground md:block">Gespräche</p>
        <NavLink href="/chat" active={chatsActive} label="Alle Chats" />
      </nav>

      <nav aria-label="Portal" className="mt-auto hidden flex-col gap-1 border-t border-border pt-4 md:flex">
        <p className="px-3 pb-1 text-xs uppercase tracking-wider text-muted-foreground">Portal</p>
        {PORTAL_LINKS.map((link) => (
          <a key={link.path} href={`${portalUrl}${link.path}`} className="rounded-md px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground">
            {link.label}
          </a>
        ))}
        <form action="/auth/logout" method="post">
          <button type="submit" className="w-full rounded-md px-3 py-1.5 text-left text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground">
            Abmelden
          </button>
        </form>
      </nav>
    </aside>
  );
}
