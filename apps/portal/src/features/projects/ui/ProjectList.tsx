import Link from "next/link";
import { Button } from "@ugur/ui";
import { startProjectChat, unregisterProject } from "../actions";
import type { Project } from "../types";

const WRITE_RULE: Record<Project["writeMode"], string> = {
  "dev-first": "Schreibt auf dev, Release per Pull Request",
  "pr-only": "Nur agent/-Branches, Änderungen per Pull Request",
};

/** Repositories the agents may work on. Only these are readable or writable for them. */
export function ProjectList({ projects }: { projects: Project[] }) {
  if (!projects.length) return <p className="text-sm text-muted-foreground">Noch kein Projekt registriert.</p>;
  return (
    <ul className="grid gap-3 md:grid-cols-2">
      {projects.map((project) => (
        <li key={project.id} className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h3 className="font-medium">
                <Link href={`/projects/${project.id}`} className="underline-offset-2 hover:underline">
                  {project.name}
                </Link>
              </h3>
              <p className="truncate font-mono text-xs text-muted-foreground">{project.repo ?? "ohne Repository"}</p>
            </div>
            <span className="shrink-0 rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground">
              {project.visibility === "private" ? "privat" : "öffentlich"}
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            {WRITE_RULE[project.writeMode]} · Ziel {project.defaultBranch}
            {project.modelPolicy === "strict" ? " · nur Modelle ohne Datenauswertung" : " · alle Modelle mit Schlüssel"}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <Button asChild variant="secondary">
              <Link href={`/projects/${project.id}`}>Sprints &amp; Planung</Link>
            </Button>
            <form action={startProjectChat}>
              <input type="hidden" name="id" value={project.id} />
              <Button type="submit">Chat starten</Button>
            </form>
            {project.id === "uguroezdamar" ? null : (
              <form action={unregisterProject}>
                <input type="hidden" name="id" value={project.id} />
                <Button type="submit" variant="secondary">
                  Entfernen
                </Button>
              </form>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}
