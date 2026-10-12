import { ProjectGrid } from "@/src/features/projects";
import { getSiteProjects } from "@/src/features/projects/queries";

export const dynamic = "force-dynamic";

export default async function ProjectsPage() {
  const projects = await getSiteProjects();

  return (
    <div className="mx-auto max-w-7xl px-6 sm:px-8 lg:px-12 py-16 md:py-24">
      <ProjectGrid projects={projects} />
    </div>
  );
}
