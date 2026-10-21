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
      <div>
        {project.cover ? (
          <figure className="mb-6">
            <div className="relative aspect-[16/9] w-full overflow-hidden border-y border-border bg-surface">
              <Image src={project.cover.src} alt={project.cover.alt} fill preload={preloadCover} sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw" className="object-cover transition-transform duration-500 group-hover:scale-[1.02] motion-reduce:transition-none motion-reduce:group-hover:scale-100" />
            </div>
            {project.cover.caption ? <figcaption className="mt-2 text-xs leading-5 text-muted-foreground">{project.cover.caption}</figcaption> : null}
          </figure>
        ) : null}

        <p className="page-eyebrow mb-3">{index !== undefined ? <><span>{String(index + 1).padStart(2, "0")}</span><span className="mx-2" aria-hidden="true">/</span></> : null}{[project.category, period].filter(Boolean).join(" · ")}</p>
        <div className="mb-2 flex items-baseline justify-between gap-3">
          <Heading className="font-serif text-2xl font-medium leading-tight text-foreground md:text-3xl">
            <Link href={`${locale === "de" ? "/de" : ""}/projects/${project.slug}`} className="rounded-xs decoration-border underline-offset-4 transition-colors hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring">{project.title}</Link>
          </Heading>
          {project.draft ? <span className="shrink-0 border border-border px-2 py-1 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">{text.draft}</span> : null}
        </div>
        <p className="mb-6 max-w-2xl font-sans text-sm leading-7 text-muted-foreground md:text-base">{project.summary}</p>
        <ul aria-label={`${text.technologies} — ${project.title}`} className="mb-5 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
          {project.technologies.slice(0, 5).map((technology) => <li key={technology}>{technology}</li>)}
        </ul>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-3 font-mono text-xs uppercase tracking-wider">
        <Link href={`${locale === "de" ? "/de" : ""}/projects/${project.slug}`} aria-label={`${text.caseStudy}: ${project.title}`} className="inline-flex min-h-11 items-center gap-1 text-foreground underline decoration-border underline-offset-4 transition-colors hover:text-foreground/80 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring">
          {text.caseStudy} <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
        </Link>
        {links.map((link) => (
          <a key={link.url} href={link.url} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center gap-1 text-muted-foreground underline decoration-border underline-offset-4 transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring">
            {link.label} <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
          </a>
        ))}
      </div>
    </article>
  );
}
