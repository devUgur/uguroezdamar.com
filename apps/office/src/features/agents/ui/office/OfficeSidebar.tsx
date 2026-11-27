"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@ugur/core";
import { ThemeToggle } from "@ugur/ui";
import type { OfficeScope, ThreadProject } from "../../types";
import { ScopeSelect } from "./ScopeSelect";

interface OfficeSidebarProps {
  projects: ThreadProject[];
  /** Origin of the admin portal of the same stage: settings live there. */
  portalUrl: string;
  /** The room's scope. Outside the room (chats) the menu opens the room in the chosen scope. */
  scope?: OfficeScope;
  onScopeChange?: (next: OfficeScope) => void;
}

const PORTAL_LINKS = [
  { path: "/work", label: "Aufgaben" },
  { path: "/usage", label: "Verbrauch & Kosten" },
  { path: "/projects", label: "Repositories" },
  { path: "/models", label: "Modelle" },
  { path: "/organization", label: "Organisation" },
];

const itemClass = "flex shrink-0 items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

/** Left navigation: the scope menu first, then the office's views, then the way into the portal. */
export function OfficeSidebar({ projects, portalUrl, scope = null, onScopeChange }: OfficeSidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const inRoom = pathname === "/";
  const changeScope = onScopeChange ?? ((next: OfficeScope) => router.push(next ? `/?project=${encodeURIComponent(next)}` : "/"));
  const roomHref = scope ? `/?project=${encodeURIComponent(scope)}` : "/";

  return (
    <aside className="flex shrink-0 flex-col gap-4 border-b border-border bg-card p-3 md:h-full md:w-60 md:border-b-0 md:border-r md:p-4">
      <div className="flex items-center justify-between gap-2">
        <Link href={roomHref} className="font-serif text-xl">
          Office
        </Link>
        <ThemeToggle />
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="text-xs uppercase tracking-wider text-muted-foreground">Bereich</span>
        <ScopeSelect projects={projects} value={scope} onChange={changeScope} />
      </div>

      <nav aria-label="Office" className="flex gap-1 md:flex-col">
        <Link href={roomHref} aria-current={inRoom ? "page" : undefined} className={cn(itemClass, inRoom && "bg-accent font-medium")}>
          Büro
        </Link>
        <Link href="/chat" aria-current={pathname.startsWith("/chat") ? "page" : undefined} className={cn(itemClass, pathname.startsWith("/chat") && "bg-accent font-medium")}>
          Chats
        </Link>
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
