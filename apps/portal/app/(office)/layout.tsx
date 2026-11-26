export const dynamic = "force-dynamic";

import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { getCurrentSession } from "@/src/adapters/auth";

/**
 * The office is its own fullscreen app (no portal shell), with the same login as the portal. On
 * office.uguroezdamar.com the proxy serves it at "/"; the session cookie belongs to that host.
 */
export default async function OfficeLayout({ children }: { children: ReactNode }) {
  if (!(await getCurrentSession())) redirect("/login?next=/office");
  return children;
}
