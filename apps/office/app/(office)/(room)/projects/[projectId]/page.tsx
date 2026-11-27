import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { listProjects, OfficeOverviewPanel } from "@/src/features/agents";

export const metadata: Metadata = { title: "Projekt" };

/** One project as the inner scope: only its widgets load here, the room of the layout stays. */
export default async function ProjectScope({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  if (!/^[a-z0-9-]{1,60}$/.test(projectId) || !(await listProjects()).some((project) => project.id === projectId)) notFound();
  return <OfficeOverviewPanel scope={projectId} />;
}
