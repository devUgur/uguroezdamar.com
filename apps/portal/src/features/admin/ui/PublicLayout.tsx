import type { ReactNode } from "react";
import { Topbar, Footer } from "@ugur/ui";

/**
 * Layout for unauthenticated portal pages (e.g. public landing at "/").
 * No sidebar – Topbar + main + Footer.
 */
export function PublicLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-col min-h-dvh">
      <Topbar />
      <main className="flex-1">
        {children}
      </main>
      <Footer />
    </div>
  );
}
