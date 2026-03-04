import ProjectForm from "@/features/projects/ui/ProjectForm";
import { getAdminProjectSnapshotById } from "@/src/server/projects";

export default async function AdminProjectEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const project = await getAdminProjectSnapshotById(id);

  if (!project) {
    return <div className="p-8">Project not found.</div>;
  }

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight mb-1">Edit Project</h1>
        <p className="text-muted-foreground">Update content, links, and assets for this project.</p>
      </div>

      <div className="bg-card border rounded-xl p-6 shadow-sm">
        <ProjectForm id={project.slug} initial={project} />
      </div>
    </div>
  );
}
