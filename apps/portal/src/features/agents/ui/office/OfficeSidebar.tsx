import Link from "next/link";
import { cn } from "@ugur/core";
import { ThemeToggle } from "@ugur/ui";
import type { OfficeScope, ThreadProject } from "../../types";

interface OfficeSidebarProps {
  projects: ThreadProject[];
  scope: OfficeScope;
}

const PORTAL_LINKS = [
  { href: "/work", label: "Aufgaben" },
  { href: "/chat", label: "Chats" },
  { href: "/usage", label: "Verbrauch & Kosten" },
  { href: "/projects", label: "Repositories" },
  { href: "/models", label: "Modelle" },
];

function ScopeLink({ href, active, label, hint }: { href: string; active: boolean; label: string; hint?: string }) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex shrink-0 items-baseline justify-between gap-2 rounded-md px-3 py-2 text-sm transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        active && "bg-accent font-medium",
      )}
    >
      <span className="truncate">{label}</span>
      {hint ? <span className="text-xs text-muted-foreground">{hint}</span> : null}
    </Link>
  );
}

/**
 * Left navigation of the office: the scope first (company, then each project as an inner layer), then the way back into
 * the portal. The scope travels as ?project= and every chat opened from here inherits it.
 */
export function OfficeSidebar({ projects, scope }: OfficeSidebarProps) {
  return (
    <aside className="flex shrink-0 flex-col gap-4 border-b border-border bg-card p-3 md:h-full md:w-60 md:border-b-0 md:border-r md:p-4">
      <div className="flex items-center justify-between gap-2">
        <Link href="/office" className="font-serif text-xl">
          Office
        </Link>
        <ThemeToggle />
      </div>

      <nav aria-label="Bereich" className="flex gap-1 overflow-x-auto md:flex-col md:overflow-visible">
        <p className="hidden px-3 pb-1 text-xs uppercase tracking-wider text-muted-foreground md:block">Bereich</p>
        <ScopeLink href="/office" active={scope === null} label="Firma" hint="alle" />
        {projects.map((project) => (
          <ScopeLink
            key={project.id}
            href={`/office?project=${encodeURIComponent(project.id)}`}
            active={scope === project.id}
            label={project.name}
            hint={project.visibility === "private" ? "privat" : undefined}
          />
        ))}
      </nav>

      <nav aria-label="Portal" className="mt-auto hidden flex-col gap-1 border-t border-border pt-4 md:flex">
        {PORTAL_LINKS.map((link) => (
          <Link key={link.href} href={link.href} className="rounded-md px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground">
            {link.label}
          </Link>
        ))}
        <Link href="/" className="rounded-md px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground">
          Zum Portal
        </Link>
      </nav>
    </aside>
  );
}
