import { getProjectsSnapshot } from "@/apps/portal/src/adapters/projects";
import Link from "next/link";

export default async function ProjectsPage() {
  const projects = await getProjectsSnapshot();

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight mb-1">Projects</h1>
          <p className="text-muted-foreground">Manage projects with structured links and image assets.</p>
        </div>
        <Link href="/admin/projects/new" className="portal-btn-primary">
          New Project
        </Link>
      </div>

      <div className="border rounded-xl overflow-hidden bg-card shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="p-4 text-left font-medium">Title</th>
              <th className="p-4 text-left font-medium">Slug</th>
              <th className="p-4 text-left font-medium">Status</th>
              <th className="p-4 text-left font-medium">Tags</th>
              <th className="p-4 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {projects.length === 0 ? (
              <tr>
                <td colSpan={5} className="p-8 text-center text-muted-foreground italic">No projects found.</td>
              </tr>
            ) : (
              projects.map((project) => (
                <tr key={project._id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                  <td className="p-4 font-medium">{project.title}</td>
                  <td className="p-4 text-muted-foreground font-mono text-xs">{project.slug}</td>
                  <td className="p-4">
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                        project.status === "published"
                          ? "bg-green-100 text-green-700"
                          : project.status === "archived"
                            ? "bg-zinc-200 text-zinc-700"
                            : "bg-yellow-100 text-yellow-700"
                      }`}>
                        {project.status}
                      </span>
                      {project.featured && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-yellow-400 text-yellow-900">
                          Featured
                        </span>
                      )}
                      {project.content && project.content.length > 100 && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-blue-100 text-blue-700">
                          Case Study
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="p-4">
                    <div className="flex gap-1 flex-wrap">
                      {project.tags.map((tag) => (
                        <span key={tag} className="px-1.5 py-0.5 bg-muted rounded text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                          {tag}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="p-4 text-right">
                    <Link href={`/projects/${project.slug}`} target="_blank" className="text-xs text-blue-500 hover:underline mr-4">
                      View
                    </Link>
                    <Link href={`/admin/projects/${project._id}`} className="text-xs text-blue-500 hover:underline">
                      Edit
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
