import type { ProjectRecord } from "../types";
import { ProjectCard } from "./ProjectCard";

export function ProjectGrid({ projects }: { projects: ProjectRecord[] }) {
  return (
    <div>
      {/* Editorial Header */}
      <div className="max-w-3xl mb-12 md:mb-16">
        <div className="font-mono text-xs uppercase tracking-widest text-muted-foreground mb-3">
          Project catalog
        </div>
        <h1 className="font-serif text-[clamp(2.5rem,5vw+0.5rem,4rem)] leading-tight tracking-tight text-foreground mb-4">
          Projects
        </h1>
        <p className="font-sans text-base md:text-lg leading-relaxed text-muted-foreground">
          Browse project entries that have been published for this portfolio. Details and available references vary by project.
        </p>
      </div>

      {projects.length === 0 ? (
        <div className="rounded-lg border border-border/80 bg-surface/30 p-12 text-center max-w-xl mx-auto space-y-3 font-mono text-xs text-muted-foreground">
          <p className="font-serif text-xl text-foreground">No projects have been published yet.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {projects.map((p) => (
            <ProjectCard key={p.slug} project={p} />
          ))}
        </div>
      )}
    </div>
  );
}

export default ProjectGrid;
