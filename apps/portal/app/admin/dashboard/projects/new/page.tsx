import ProjectForm from "@/src/features/projects/ui/ProjectForm";

export default function AdminProjectNewPage() {
  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight mb-1">New Project</h1>
        <p className="text-muted-foreground">Create a project with structured links and images for multiple platforms.</p>
      </div>

      <div className="bg-card border rounded-xl p-6 shadow-sm">
        <ProjectForm />
      </div>
    </div>
  );
}
