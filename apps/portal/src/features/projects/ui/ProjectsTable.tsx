"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { GripVertical } from "lucide-react";
import { cn } from "@ugur/core";
import { toast } from "@ugur/ui";

export type ProjectRow = {
  _id: string;
  title: string;
  slug: string;
  status: string;
  featured?: boolean;
  tags: string[];
  content?: string | null;
};

type Props = {
  initialProjects: ProjectRow[];
  /** Base URL of the public site (e.g. http://localhost:3000). Used for "View project" link. */
  siteUrl?: string;
};

export function ProjectsTable({ initialProjects, siteUrl }: Props) {
  const router = useRouter();
  const [projects, setProjects] = useState<ProjectRow[]>(initialProjects);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dropTargetIndex, setDropTargetIndex] = useState<number | null>(null);
  const [isReordering, setIsReordering] = useState(false);

  const persistOrder = useCallback(
    async (ordered: ProjectRow[]) => {
      setIsReordering(true);
      try {
        const res = await fetch("/api/projects/reorder", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ projectIds: ordered.map((p) => p._id) }),
        });
        const data = await res.json();
        if (!res.ok || !data.ok) throw new Error(data.error ?? "Reorder failed");
        setProjects(ordered);
        router.refresh();
        toast.success("Order saved");
      } catch (err: unknown) {
        toast.error((err as Error)?.message ?? "Could not save order");
      } finally {
        setIsReordering(false);
      }
    },
    [router]
  );

  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", String(index));
    e.dataTransfer.setData("application/json", JSON.stringify({ index }));
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
    setDropTargetIndex(null);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (draggedIndex === null) return;
    if (index !== draggedIndex) setDropTargetIndex(index);
  };

  const handleDragLeave = () => {
    setDropTargetIndex(null);
  };

  const handleDrop = (e: React.DragEvent, toIndex: number) => {
    e.preventDefault();
    setDropTargetIndex(null);
    const fromIndex = draggedIndex;
    setDraggedIndex(null);
    if (fromIndex == null || fromIndex === toIndex) return;

    const next = [...projects];
    const [removed] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, removed);
    setProjects(next);
    void persistOrder(next);
  };

  return (
    <div className="relative border rounded-xl overflow-hidden bg-card shadow-sm">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/50">
            <th className="w-10 p-2 text-left" aria-label="Order" />
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
              <td colSpan={6} className="p-8 text-center text-muted-foreground italic">
                No projects found.
              </td>
            </tr>
          ) : (
            projects.map((project, index) => (
              <tr
                key={project._id}
                onDragOver={(e) => handleDragOver(e, index)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, index)}
                className={cn(
                  "border-b last:border-0 transition-colors",
                  draggedIndex === index && "opacity-50 bg-muted/50",
                  dropTargetIndex === index && "ring-1 ring-primary/30 bg-primary/5",
                  !draggedIndex && "hover:bg-muted/30"
                )}
              >
                <td className="p-2">
                  <div
                    draggable
                    onDragStart={(e) => handleDragStart(e, index)}
                    onDragEnd={handleDragEnd}
                    className="flex items-center justify-center w-8 h-8 rounded cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground hover:bg-muted/50"
                  >
                    <GripVertical className="w-4 h-4" aria-hidden />
                  </div>
                </td>
                <td className="p-4 font-medium">{project.title}</td>
                <td className="p-4 text-muted-foreground font-mono text-xs">{project.slug}</td>
                <td className="p-4">
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        "px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider",
                        project.status === "published" && "bg-green-100 text-green-700",
                        project.status === "archived" && "bg-zinc-200 text-zinc-700",
                        project.status === "draft" && "bg-yellow-100 text-yellow-700"
                      )}
                    >
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
                    {(project.tags ?? []).map((tag: string) => (
                      <span
                        key={tag}
                        className="px-1.5 py-0.5 bg-muted rounded text-[10px] font-medium uppercase tracking-wider text-muted-foreground"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </td>
                <td className="p-4 text-right">
                  <Link
                    href={`${siteUrl || "http://localhost:3000"}/projects/${project.slug}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-blue-500 hover:underline mr-4"
                  >
                    View
                  </Link>
                  <Link
                    href={`/admin/projects/${project._id}`}
                    className="text-xs text-blue-500 hover:underline"
                  >
                    Edit
                  </Link>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
      {isReordering && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/80 rounded-xl pointer-events-none">
          <span className="text-sm font-medium">Saving order…</span>
        </div>
      )}
    </div>
  );
}
