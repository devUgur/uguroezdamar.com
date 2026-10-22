import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

import { formatPeriod, projectLinks, type Project } from "@/src/content/projects";
import { copy, type Locale } from "@/src/features/navigation/copy";

export function ProjectCard({ project, index, headingLevel = "h2", preloadCover = false, locale = "en" }: { project: Project; index?: number; headingLevel?: "h2" | "h3"; preloadCover?: boolean; locale?: Locale }) {
  const period = formatPeriod(project.period, locale);
  const links = projectLinks(project);
  const text = copy[locale];
  const Heading = headingLevel;

  return (
    <article className="project-card group">
      {project.cover ? (
        <figure className="project-card__cover">
          <div className="relative aspect-[16/9] w-full overflow-hidden bg-background">
            <Image src={project.cover.src} alt={project.cover.alt} fill preload={preloadCover} sizes="(max-width: 767px) 100vw, (max-width: 1279px) 50vw, 44vw" className="object-cover transition-transform duration-500 group-hover:scale-[1.02] motion-reduce:transition-none motion-reduce:group-hover:scale-100" />
          </div>
          <figcaption className="min-h-14 px-5 py-2 text-xs leading-5 text-muted-foreground md:px-8">
            {project.cover.caption ?? <span aria-hidden="true">&nbsp;</span>}
          </figcaption>
        </figure>
      ) : null}

      <div className="project-card__body">
        <p className="page-eyebrow mb-3">
          {index !== undefined ? <><span>{String(index + 1).padStart(2, "0")}</span><span className="mx-2" aria-hidden="true">/</span></> : null}
          {[project.category, period].filter(Boolean).join(" · ")}
        </p>
        <div className="mb-2 flex items-baseline justify-between gap-3">
          <Heading className="font-serif text-2xl font-medium leading-tight text-foreground md:text-3xl">
            <Link href={`${locale === "de" ? "/de" : ""}/projects/${project.slug}`} className="decoration-border underline-offset-4 transition-colors hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring">{project.title}</Link>
          </Heading>
          {project.draft ? <span className="shrink-0 border border-border px-2 py-1 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">{text.draft}</span> : null}
        </div>
        <p className="mb-6 max-w-2xl font-sans text-sm leading-7 text-muted-foreground md:text-base">{project.summary}</p>
        <ul aria-label={`${text.technologies} — ${project.title}`} className="mb-5 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
          {project.technologies.slice(0, 5).map((technology) => <li key={technology}>{technology}</li>)}
        </ul>

        <div className="project-card__footer flex flex-wrap items-center gap-x-5 gap-y-1 font-mono text-xs uppercase tracking-wider">
          <Link href={`${locale === "de" ? "/de" : ""}/projects/${project.slug}`} aria-label={`${text.caseStudy}: ${project.title}`} className="inline-flex min-h-11 items-center gap-1 text-foreground underline decoration-border underline-offset-4 transition-colors hover:text-foreground/80 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring">
            {text.caseStudy} <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
          </Link>
          {links.map((link) => (
            <a key={link.url} href={link.url} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center gap-1 text-muted-foreground underline decoration-border underline-offset-4 transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring">
              {link.label} <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
            </a>
          ))}
        </div>
      </div>
    </article>
  );
}
