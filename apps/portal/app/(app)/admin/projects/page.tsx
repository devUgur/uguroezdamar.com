import { getProjectsSnapshot } from "@/apps/portal/src/adapters/projects";
import Link from "next/link";
import { ProjectsTable } from "@/src/features/projects/ui/ProjectsTable";

export default async function ProjectsPage() {
  const projects = await getProjectsSnapshot();
  const siteUrl = process.env.SITE_URL ?? "http://localhost:3000";

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight mb-1">Projects</h1>
          <p className="text-muted-foreground">Manage projects. Drag the handle to reorder.</p>
        </div>
        <Link href="/admin/projects/new" className="portal-btn-primary">
          New Project
        </Link>
      </div>

      <ProjectsTable initialProjects={projects} siteUrl={siteUrl} />
    </div>
  );
}
