import type { Project } from "@/src/content/projects";
import { ProjectCard } from "@/src/components/public/ProjectCard";
import { PageIntro } from "@/src/components/public/PageIntro";
import { copy, type Locale } from "@/src/features/navigation/copy";

export function ProjectGrid({ projects, locale = "en" }: { projects: Project[]; locale?: Locale }) {
  const firstCoverIndex = projects.findIndex((project) => project.cover);
  const text = copy[locale];

  return (
    <div>
      <PageIntro section={text.project} title={text.projects} description={text.projectDescription} />

      {projects.length === 0 ? (
        <div className="mt-14 max-w-xl border-y border-border py-8 space-y-3 text-sm text-muted-foreground">
          <p className="font-serif text-2xl text-foreground">{text.noProjects}</p>
        </div>
      ) : (
        <div className="mt-14 grid grid-cols-1 border-t border-border md:grid-cols-2 md:gap-x-12">
          {projects.map((p, index) => (
            <ProjectCard key={p.slug} project={p} preloadCover={index === firstCoverIndex} locale={locale} />
          ))}
        </div>
      )}
    </div>
  );
}

export default ProjectGrid;
