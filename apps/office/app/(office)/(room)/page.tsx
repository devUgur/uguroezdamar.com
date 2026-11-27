import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { OfficeOverviewPanel } from "@/src/features/agents";

export const metadata: Metadata = { title: "Firma" };

type Param = string | string[] | undefined;

/** The company scope. Older links with ?project= move to the project route; ?agent= stays for the room. */
export default async function CompanyScope({ searchParams }: { searchParams: Promise<{ project?: Param; agent?: Param }> }) {
  const { project, agent } = await searchParams;
  if (typeof project === "string" && /^[a-z0-9-]{1,60}$/.test(project)) {
    redirect(`/projects/${project}${typeof agent === "string" ? `?agent=${encodeURIComponent(agent)}` : ""}`);
  }
  return <OfficeOverviewPanel scope={null} />;
}
