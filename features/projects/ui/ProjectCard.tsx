import Link from "next/link";

import type { ProjectRecord } from "@/features/projects/server/queries";
import { Card } from "@/shared/ui/Card";
import { Tag } from "@/shared/ui/Tag";

export function ProjectCard({ project }: { project: ProjectRecord }) {
  return (
    <Card>
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
