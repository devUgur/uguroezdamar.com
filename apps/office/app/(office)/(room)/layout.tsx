import type { ReactNode } from "react";
import { OfficeShell } from "@/src/features/agents";

/** The room stays mounted while the scope changes: company (/) and projects (/projects/:id) are pages below it. */
export default function RoomLayout({ children }: { children: ReactNode }) {
  return <OfficeShell>{children}</OfficeShell>;
}
