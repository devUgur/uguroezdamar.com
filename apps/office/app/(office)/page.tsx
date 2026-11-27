import type { Metadata } from "next";
import { OfficePage } from "@/src/features/agents";

export const metadata: Metadata = { title: "Büro" };

/** The office. `?project=<id>` sets the scope and `?agent=<id>` opens an agent's sheet; both are read in the browser. */
export default function Office() {
  return <OfficePage />;
}
