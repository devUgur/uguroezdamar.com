export const dynamic = "force-dynamic";

import type { ReactNode } from "react";
import { requireSession } from "@/src/adapters/session";

/** Every office page needs the office session; without it the sign-in through the portal starts (ADR 0039). */
export default async function OfficeLayout({ children }: { children: ReactNode }) {
  await requireSession();
  return children;
}
