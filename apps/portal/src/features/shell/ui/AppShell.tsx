import type { ReactNode } from "react";
import { MobileNav } from "./MobileNav";
import { Sidebar } from "./Sidebar";

/**
 * Single app layout: full-viewport height, sidebar + scrollable main.
 * Use this for all authenticated portal routes (Dashboard "/" and /admin/*)
 * so the sidebar is rendered once with consistent height (100dvh).
 */
export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-[100dvh] min-h-0 flex-col overflow-hidden bg-background md:flex-row">
      <MobileNav />
      <Sidebar />
      <main className="flex-1 min-h-0 min-w-0 overflow-y-auto">
        {children}
      </main>
    </div>
  );
}
