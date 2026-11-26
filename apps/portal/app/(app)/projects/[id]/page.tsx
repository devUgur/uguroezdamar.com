import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getProjectKnowledge, getProjectOverview, ProjectDetailView } from "@/src/features/projects";

export const metadata: Metadata = { title: "Projekt" };

type Param = string | string[] | undefined;
const first = (value: Param): string | undefined => (Array.isArray(value) ? value[0] : value);
const PROJECT_ID = /^[a-z0-9-]{1,40}$/;

export default async function ProjectPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ notice?: Param; error?: Param; q?: Param }> }) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  if (!PROJECT_ID.test(id)) notFound();
  const [overview, knowledge] = await Promise.all([getProjectOverview(id), getProjectKnowledge(id, first(query.q) ?? "")]);
  if (overview.error) {
    return (
      <main className="mx-auto w-full max-w-6xl px-5 py-10">
        <p role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm">
          {overview.error}
        </p>
      </main>
    );
  }
  if (!overview.project) notFound();
  return <ProjectDetailView project={overview.project} sprints={overview.sprints} tasks={overview.tasks} knowledge={knowledge} notice={first(query.notice)} error={first(query.error)} />;
}
