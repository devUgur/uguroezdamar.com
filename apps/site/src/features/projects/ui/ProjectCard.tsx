import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

import { projectLinks, type Project } from "@/src/content/projects";

export function ProjectCard({ project }: { project: Project }) {
  const links = projectLinks(project);

  return (
    <article className="group flex flex-col justify-between rounded-lg border border-border/80 bg-surface/30 p-6 transition-all duration-300 hover:border-foreground/30 hover:bg-surface/50">
      <div>
        {project.cover ? (
          <div className="relative mb-6 aspect-video w-full overflow-hidden rounded-md border border-border/60 bg-surface">
            <Image
              src={project.cover.src}
              alt={project.cover.alt}
              fill
              sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
              className="object-cover transition-transform duration-500 group-hover:scale-[1.02] motion-reduce:transition-none motion-reduce:group-hover:scale-100"
            />
          </div>
        ) : null}

        <p className="mb-2 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">{project.category}</p>

        <div className="mb-2 flex items-baseline justify-between gap-3">
          <h2 className="font-serif text-xl font-medium text-foreground md:text-2xl">
            <Link
              href={`/projects/${project.slug}`}
              className="rounded-xs decoration-border underline-offset-4 transition-colors hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              {project.title}
            </Link>
          </h2>
          {project.draft ? (
            <span className="shrink-0 rounded-xs border border-foreground/30 bg-foreground/5 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-foreground">
              Draft
            </span>
          ) : null}
        </div>

        <p className="mb-6 line-clamp-3 font-sans text-sm leading-relaxed text-muted-foreground">{project.summary}</p>

        <ul aria-label={`Technologies for ${project.title}`} className="mb-6 flex flex-wrap gap-1.5">
          {project.technologies.slice(0, 5).map((technology) => (
            <li key={technology} className="rounded-xs border border-border/60 bg-surface/80 px-2 py-0.5 font-mono text-[10px] text-foreground/80">
              {technology}
            </li>
          ))}
        </ul>
      </div>

      <div className="flex items-center justify-between border-t border-border/50 pt-4 font-mono text-xs uppercase tracking-wider">
        <Link
          href={`/projects/${project.slug}`}
          className="inline-flex items-center gap-1 text-foreground underline decoration-border underline-offset-4 transition-colors hover:text-foreground/80"
        >
          View case study
          <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
        </Link>

        {links.length > 0 ? (
          <div className="flex items-center gap-3 text-muted-foreground">
            {links.slice(0, 2).map((link) => (
              <a key={link.url} href={link.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 transition-colors hover:text-foreground">
                <span>{link.label}</span>
                <ArrowUpRight className="h-3 w-3" aria-hidden="true" />
              </a>
            ))}
          </div>
        ) : null}
      </div>
    </article>
  );
}

export default ProjectCard;
