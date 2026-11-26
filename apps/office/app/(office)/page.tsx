import type { Metadata } from "next";
import { OfficePage } from "@/src/features/agents";

export const metadata: Metadata = { title: "Office" };

type Param = string | string[] | undefined;
const first = (value: Param) => (typeof value === "string" ? value : null);

/** `?project=<id>` opens a project as inner scope, `?agent=<id>` that agent's sheet. */
export default async function Office({ searchParams }: { searchParams: Promise<{ project?: Param; agent?: Param }> }) {
  const { project, agent } = await searchParams;
  return <OfficePage project={first(project)} initialAgentId={first(agent)} />;
}
