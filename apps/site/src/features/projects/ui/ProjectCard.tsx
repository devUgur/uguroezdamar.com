import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import type { ProjectRecord } from "../types";

export function ProjectCard({ project }: { project: ProjectRecord }) {
  const imageUrl = project.previewImageUrl || project.coverImageUrl;
  const technologies = project.tech ?? [];
  const imageAlt = project.images?.find((image) => image.url === imageUrl)?.alt ?? "";

  return (
    <article className="group flex flex-col justify-between rounded-lg border border-border/80 bg-surface/30 p-6 transition-all duration-300 hover:border-foreground/30 hover:bg-surface/50">
      <div>
        {imageUrl ? (
          <div className="relative mb-6 aspect-video w-full overflow-hidden rounded-md border border-border/60 bg-surface">
            <Image
              src={imageUrl}
              alt={imageAlt}
              fill
              sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
              unoptimized
              className="object-cover transition-transform duration-500 group-hover:scale-[1.02]"
            />
          </div>
        ) : null}

        <div className="flex items-baseline justify-between gap-3 mb-2">
          <h3 className="font-serif text-xl md:text-2xl text-foreground font-medium">
            <Link
              href={`/projects/${project.slug}`}
              className="hover:underline underline-offset-4 decoration-border transition-colors group-hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded-xs"
            >
              {project.title}
            </Link>
          </h3>
          {project.featured && imageUrl && (
            <span className="shrink-0 rounded-xs border border-foreground/30 bg-foreground/5 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-foreground">
              Featured
            </span>
          )}
        </div>

        {project.summary && (
          <p className="font-sans text-sm leading-relaxed text-muted-foreground mb-6 line-clamp-3">
            {project.summary}
          </p>
        )}

        {technologies.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-6">
            {technologies.slice(0, 5).map((t) => (
              <span
                key={t}
                className="rounded-xs border border-border/60 bg-surface/80 px-2 py-0.5 font-mono text-[10px] text-foreground/80"
              >
                {t}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="flex items-center justify-between border-t border-border/50 pt-4 font-mono text-xs uppercase tracking-wider">
        <Link
          href={`/projects/${project.slug}`}
          className="inline-flex items-center gap-1 text-foreground hover:text-foreground/80 underline underline-offset-4 decoration-border transition-colors"
        >
          View Case Study
          <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
        </Link>

        {project.links && project.links.length > 0 && (
          <div className="flex items-center gap-3 text-muted-foreground">
            {project.links.slice(0, 2).map((link) => (
              <a
                key={`${project.slug}-${link.platform}-${link.url}`}
                href={link.url}
                target="_blank"
                rel="noreferrer"
                className="hover:text-foreground transition-colors inline-flex items-center gap-1"
                title={link.label || link.platform}
              >
                <span>{link.label || link.platform}</span>
                <ArrowUpRight className="h-3 w-3" aria-hidden="true" />
              </a>
            ))}
          </div>
        )}
      </div>
    </article>
  );
}

export default ProjectCard;
