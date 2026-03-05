import ProjectForm from "@/src/features/projects/ui/ProjectForm";
import { getProjectByIdAdapter } from "@/apps/portal/src/adapters/projects";

export default async function ProjectEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const project = await getProjectByIdAdapter(id);

  if (!project) {
    return <div className="p-8">Project not found.</div>;
  }

  return (
    <div className="p-8">
      <ProjectForm id={project._id} initial={project} />
    </div>
  );
}
