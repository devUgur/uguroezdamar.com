import Image from "next/image";
import Link from "next/link";

import { formatPeriod, type Project } from "@/src/content/projects";

export function SelectedProjectCard({ project, index }: { project: Project; index: number }) {
  const period = formatPeriod(project.period);
  const technologies = project.technologies.slice(0, 4);

  return (
    <li className="border-b border-border">
      <article className="grid grid-cols-[2.5rem_minmax(0,1fr)] gap-x-4 py-7 md:grid-cols-[3rem_minmax(0,1fr)] md:gap-x-6 md:py-9">
        <span className="pt-1 font-mono text-xs text-muted-foreground" aria-hidden="true">
          {String(index + 1).padStart(2, "0")}
        </span>
        <div className="min-w-0">
          {project.cover ? (
            <Link href={`/projects/${project.slug}`} tabIndex={-1} aria-hidden="true" className="relative mb-6 block aspect-video overflow-hidden rounded-md border border-border/60 bg-surface">
              <Image
                src={project.cover.src}
                alt=""
                fill
                sizes="(max-width: 768px) 100vw, 58vw"
                className="object-cover transition-transform duration-500 hover:scale-[1.02] motion-reduce:transition-none motion-reduce:hover:scale-100"
              />
            </Link>
          ) : null}
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2">
            <h3 className="text-2xl leading-tight md:text-3xl">
              <Link href={`/projects/${project.slug}`} className="hover:text-muted-foreground focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring">
                {project.title}
              </Link>
            </h3>
            <span className="font-mono text-xs text-muted-foreground">
              {[project.category, period].filter(Boolean).join(" · ")}
            </span>
          </div>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground md:text-base md:leading-7">
            {project.summary}
          </p>
          <ul aria-label={`Technologies for ${project.title}`} className="mt-4 flex flex-wrap gap-x-4 gap-y-2 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground md:text-xs">
            {technologies.map((technology) => <li key={technology}>{technology}</li>)}
          </ul>
        </div>
      </article>
    </li>
  );
}

export default SelectedProjectCard;
