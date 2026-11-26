import Link from "next/link";
import { Button } from "@ugur/ui";
import { startProjectChat } from "../actions";
import type { Project, ProjectPreviews, ProjectTask, Sprint } from "../types";
import { PlanningForms } from "./PlanningForms";
import { PreviewSection } from "./PreviewSection";
import { SprintSection } from "./SprintSection";
import { TaskLine } from "./TaskLine";

interface ProjectDetailViewProps {
  project: Project;
  sprints: Sprint[];
  tasks: ProjectTask[];
  previews: ProjectPreviews;
  notice?: string;
  error?: string;
}

/** /projects/[id]: one project (= one repository) with its sprints, backlog and planning. */
export function ProjectDetailView({ project, sprints, tasks, previews, notice, error }: ProjectDetailViewProps) {
  const openSprints = sprints.filter((sprint) => sprint.status !== "done");
  const done = sprints.filter((sprint) => sprint.status === "done");
  const backlog = tasks.filter((task) => !task.sprintId && task.status !== "done");
  const finishedLoose = tasks.filter((task) => !task.sprintId && task.status === "done");
  const tasksOf = (sprintId: string) => tasks.filter((task) => task.sprintId === sprintId);
  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-5 py-10">
      <header className="flex flex-col gap-3">
        <Link href="/projects" className="text-xs text-muted-foreground underline-offset-2 hover:underline">
          ← Alle Projekte
        </Link>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="min-w-0">
            <h1 className="font-serif text-3xl">{project.name}</h1>
            <p className="font-mono text-xs text-muted-foreground">
              {project.repo ? (
                <a href={`https://github.com/${project.repo}`} target="_blank" rel="noreferrer" className="underline-offset-2 hover:underline">
                  {project.repo}
                </a>
              ) : (
                "ohne Repository"
              )}
              {" · "}
              {project.visibility === "private" ? "privat" : "öffentlich"} · Ziel {project.defaultBranch}
              {project.domain ? ` · ${project.domain}` : ""}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <form action={startProjectChat}>
              <input type="hidden" name="id" value={project.id} />
              <Button type="submit">Chat starten</Button>
            </form>
            <Button asChild variant="secondary">
              <Link href="/work">Board</Link>
            </Button>
          </div>
        </div>
      </header>

      {notice ? (
        <p role="status" className="rounded-md border border-border bg-muted p-3 text-sm">
          {notice}
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm">
          {error}
        </p>
      ) : null}

      <PreviewSection previews={previews} />

      <section className="flex flex-col gap-4" aria-labelledby="sprints-title">
        <h2 id="sprints-title" className="font-serif text-xl">
          Sprints
        </h2>
        {openSprints.length ? (
          openSprints.map((sprint) => <SprintSection key={sprint.id} sprint={sprint} tasks={tasksOf(sprint.id)} projectId={project.id} openSprints={openSprints} />)
        ) : (
          <p className="text-sm text-muted-foreground">Noch kein offener Sprint. Lege unten einen an und plane Aufgaben aus dem Backlog ein.</p>
        )}
      </section>

      <section className="flex flex-col gap-3" aria-labelledby="backlog-title">
        <h2 id="backlog-title" className="font-serif text-xl">
          Backlog ({backlog.length})
        </h2>
        {backlog.length ? (
          <ul className="rounded-lg border border-border px-4">
            {backlog.map((task) => (
              <TaskLine key={task.id} task={task} projectId={project.id} sprints={openSprints} />
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">Keine offenen Aufgaben ohne Sprint.</p>
        )}
      </section>

      <section className="flex flex-col gap-4" aria-labelledby="plan-title">
        <h2 id="plan-title" className="font-serif text-xl">
          Planen
        </h2>
        <PlanningForms projectId={project.id} openSprints={openSprints} />
      </section>

      {done.length || finishedLoose.length ? (
        <details className="rounded-lg border border-border p-4">
          <summary className="cursor-pointer font-medium">Abgeschlossen ({done.length} Sprints)</summary>
          <div className="mt-4 flex flex-col gap-4">
            {done.map((sprint) => (
              <SprintSection key={sprint.id} sprint={sprint} tasks={tasksOf(sprint.id)} projectId={project.id} openSprints={openSprints} />
            ))}
          </div>
        </details>
      ) : null}
    </main>
  );
}
