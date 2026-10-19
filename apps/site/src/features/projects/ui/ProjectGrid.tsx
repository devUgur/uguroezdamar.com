import type { Project } from "@/src/content/projects";
import { ProjectCard } from "@/src/components/public/ProjectCard";
import { PageIntro } from "@/src/components/public/PageIntro";

export function ProjectGrid({ projects }: { projects: Project[] }) {
  return (
    <div>
      <PageIntro section="Project catalog" title="Projects" description="Case studies of software I have built: the problem, the solution and the architecture behind it." />

      {projects.length === 0 ? (
        <div className="mt-14 max-w-xl border-y border-border py-8 space-y-3 text-sm text-muted-foreground">
          <p className="font-serif text-2xl text-foreground">No projects have been published yet.</p>
        </div>
      ) : (
        <div className="mt-14 grid grid-cols-1 border-t border-border md:grid-cols-2 md:gap-x-12">
          {projects.map((p) => (
            <ProjectCard key={p.slug} project={p} />
          ))}
        </div>
      )}
    </div>
  );
}

export default ProjectGrid;
