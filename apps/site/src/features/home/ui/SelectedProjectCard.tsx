import Link from "next/link";
import type { ProjectRecord } from "@ugur/server";

function getProjectPeriod(project: ProjectRecord): string | null {
  if (project.ongoing) return project.yearFrom ? `${project.yearFrom}–Present` : "Ongoing";
  if (project.yearFrom && project.yearTo && project.yearFrom !== project.yearTo) {
    return `${project.yearFrom}–${project.yearTo}`;
  }
  const year = project.yearTo ?? project.yearFrom;
  return year ? String(year) : null;
}

export function SelectedProjectCard({
  project,
  index,
}: {
  project: ProjectRecord;
  index: number;
}) {
  const period = getProjectPeriod(project);
  const technologies = project.tech?.slice(0, 3) ?? [];

  return (
    <li className="border-b border-border">
      <article className="grid grid-cols-[2.5rem_minmax(0,1fr)] gap-x-4 py-7 md:grid-cols-[3rem_minmax(0,1fr)] md:gap-x-6 md:py-9">
        <span className="pt-1 font-mono text-xs text-muted-foreground" aria-hidden="true">
          {String(index + 1).padStart(2, "0")}
        </span>
        <div className="min-w-0">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2">
            <h3 className="text-2xl leading-tight md:text-3xl">
              <Link href={`/projects/${project.slug}`} className="hover:text-muted-foreground focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring">
                {project.title}
              </Link>
            </h3>
            {period ? <span className="font-mono text-xs text-muted-foreground">{period}</span> : null}
          </div>
          {project.summary ? (
            <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground md:text-base md:leading-7">
              {project.summary}
            </p>
          ) : null}
          {technologies.length ? (
            <ul aria-label={`Technologies for ${project.title}`} className="mt-4 flex flex-wrap gap-x-4 gap-y-2 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground md:text-xs">
              {technologies.map((technology) => <li key={technology}>{technology}</li>)}
            </ul>
          ) : null}
        </div>
      </article>
    </li>
  );
}

export default SelectedProjectCard;
