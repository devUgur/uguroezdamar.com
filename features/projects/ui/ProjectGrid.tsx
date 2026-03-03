import type { ProjectRecord } from "@/features/projects/types";
import { ProjectHero } from "@/features/projects/ui/ProjectHero";
import { ProjectCard } from "@/features/projects/ui/ProjectCard";

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
