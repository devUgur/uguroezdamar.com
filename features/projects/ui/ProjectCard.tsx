import Link from "next/link";

import type { ProjectRecord } from "@/features/projects/types";
import { Card } from "@ugur/ui";
import { Tag } from "@ugur/ui";

export function ProjectCard({ project }: { project: ProjectRecord }) {
  return (
    <Card>
      {project.coverImageUrl ? (
        <div className="mb-3 overflow-hidden rounded-md border bg-muted/20">
          <img src={project.coverImageUrl} alt={project.title} className="w-full h-44 object-cover" />
        </div>
      ) : null}

      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-sm font-semibold">
            <Link href={`/projects/${project.slug}`} className="hover:underline">
              {project.title}
            </Link>
          </h3>
          {project.summary ? (
            <p className="mt-1 text-sm text-zinc-600">{project.summary}</p>
          ) : null}
        </div>
      </div>

      {project.links.length ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {project.links.map((link) => (
            <a key={`${project.slug}-${link.platform}-${link.url}`} href={link.url} target="_blank" rel="noreferrer" className="text-xs underline underline-offset-2 text-muted-foreground hover:text-foreground">
              {link.label || link.platform}
            </a>
          ))}
        </div>
      ) : null}

      {project.tags.length ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {project.tags.map((t) => (
            <Tag key={t}>{t}</Tag>
          ))}
        </div>
      ) : null}
    </Card>
  );
}
