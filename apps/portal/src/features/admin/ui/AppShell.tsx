import type { ReactNode } from "react";
import { Sidebar } from "./Sidebar";

/**
 * Single app layout: full-viewport height, sidebar + scrollable main.
 * Use this for all authenticated portal routes (Dashboard "/" and /admin/*)
 * so the sidebar is rendered once with consistent height (100dvh).
 */
export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-[100dvh] min-h-0 overflow-hidden bg-background">
      <Sidebar />
      <main className="flex-1 min-w-0 overflow-y-auto">
        {children}
      </main>
    </div>
  );
}
