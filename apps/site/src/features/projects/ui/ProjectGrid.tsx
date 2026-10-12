import type { ProjectRecord } from "../types";
import { ProjectHero } from "./ProjectHero";
import { ProjectCard } from "./ProjectCard";

export function ProjectGrid({ projects }: { projects: ProjectRecord[] }) {
  return (
    <div className="py-10">
      <ProjectHero />
      {projects.length === 0 ? (
        <p className="py-8 text-sm text-muted-foreground">No projects have been published yet. Please check back soon.</p>
      ) : (
        <div className="grid gap-4">
          {projects.map((p) => (
            <ProjectCard key={p.slug} project={p} />
          ))}
        </div>
      )}
    </div>
  );
}
