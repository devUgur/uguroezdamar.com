import type { ProjectRecord } from "../types";
import { ProjectHero } from "./ProjectHero";
import { ProjectCard } from "./ProjectCard";

export function ProjectGrid({ projects }: { projects: ProjectRecord[] }) {
  return (
    <div className="py-10">
      <ProjectHero />
      <div className="grid gap-4">
        {projects.map((p) => (
          <ProjectCard key={p.slug} project={p} />
        ))}
      </div>
    </div>
  );
}
