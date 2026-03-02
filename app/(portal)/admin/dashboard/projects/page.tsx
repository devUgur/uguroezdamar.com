import { getAllProjects } from "@/features/projects/server/queries";
import { getWorkItems } from "@/features/work/server/mongo";
import Link from "next/link";
import React from "react";

export default async function AdminProjectsPage() {
  const projects = await getAllProjects();
  const workItems = await getWorkItems({ limit: 200 });

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight mb-1">Projects</h1>
          <p className="text-muted-foreground">Manage your portfolio projects (MDX files).</p>
        </div>
        <button className="px-4 py-2 bg-foreground text-background rounded-lg text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50" disabled title="Coming soon: Project Editor">
          New Project
        </button>
      </div>

      <div className="mt-10">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold tracking-tight mb-1">Work Items</h2>
            <p className="text-muted-foreground">Manage database-backed work items (live previews, links).</p>
          </div>
          <Link href="/admin/dashboard/work-items" className="px-3 py-1.5 bg-foreground text-background rounded-md text-sm font-medium hover:opacity-90">
            Manage Work Items
          </Link>
        </div>

        <div className="border rounded-xl overflow-hidden bg-card shadow-sm mt-4">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="p-4 text-left font-medium">Title</th>
                <th className="p-4 text-left font-medium">Slug</th>
                <th className="p-4 text-left font-medium">Live</th>
                <th className="p-4 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {workItems.length === 0 ? (
                <tr>
                  <td colSpan={4} className="p-8 text-center text-muted-foreground italic">No work items found.</td>
                </tr>
              ) : (
                workItems.map((w) => (
                  <tr key={w.slug} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                    <td className="p-4 font-medium">{w.title}</td>
                    <td className="p-4 text-muted-foreground font-mono text-xs">{w.slug}</td>
                    <td className="p-4">
                      {w.links?.live ? (
                        <a href={w.links.live} target="_blank" rel="noreferrer" className="text-xs text-blue-500 hover:underline">Open</a>
                      ) : (
                        <span className="text-muted-foreground text-xs">—</span>
                      )}
                    </td>
                    <td className="p-4 text-right">
                      <Link href={`/admin/dashboard/work-items/${w.slug}`} className="text-xs text-blue-500 hover:underline mr-4">
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

      <div className="border rounded-xl overflow-hidden bg-card shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="p-4 text-left font-medium">Title</th>
              <th className="p-4 text-left font-medium">Slug</th>
              <th className="p-4 text-left font-medium">Tags</th>
              <th className="p-4 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {projects.length === 0 ? (
              <tr>
                <td colSpan={4} className="p-8 text-center text-muted-foreground italic">No projects found.</td>
              </tr>
            ) : (
              projects.map((project) => (
                <tr key={project.slug} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                  <td className="p-4 font-medium">{project.title}</td>
                  <td className="p-4 text-muted-foreground font-mono text-xs">{project.slug}</td>
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
                    <button className="text-xs text-muted-foreground cursor-not-allowed" disabled>
                      Edit
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4 text-sm text-blue-600">
        Note: Currently, projects are managed via MDX files in the <code className="bg-blue-500/10 px-1 rounded">content/projects</code> directory. An online editor is planned for a future update.
      </div>
    </div>
  );
}
