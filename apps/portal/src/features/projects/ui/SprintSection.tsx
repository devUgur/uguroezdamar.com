import { Button } from "@ugur/ui";
import { changeSprintStatus } from "../actions";
import type { ProjectTask, Sprint } from "../types";
import { TaskLine } from "./TaskLine";

interface SprintSectionProps {
  sprint: Sprint;
  tasks: ProjectTask[];
  projectId: string;
  openSprints: Sprint[];
}

const STATUS: Record<Sprint["status"], string> = { planned: "geplant", active: "läuft", done: "abgeschlossen" };
const date = (value: number | null): string => (value ? new Date(value * 1000).toLocaleDateString("de-DE") : "offen");

/** A sprint with its goal, progress and tasks, plus starting or closing it. */
export function SprintSection({ sprint, tasks, projectId, openSprints }: SprintSectionProps) {
  const next = sprint.status === "planned" ? { status: "active", label: "Sprint starten" } : sprint.status === "active" ? { status: "done", label: "Sprint abschließen" } : null;
  return (
    <section className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4" aria-label={`Sprint ${sprint.name}`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="font-medium">
            {sprint.name} <span className="ml-1 rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground">{STATUS[sprint.status]}</span>
          </h3>
          <p className="text-xs text-muted-foreground">
            {date(sprint.startsAt)} – {date(sprint.endsAt)} · {sprint.tasksDone}/{sprint.tasksTotal} erledigt
            {sprint.pointsTotal ? ` · ${sprint.pointsTotal} SP` : ""}
          </p>
          {sprint.goal ? <p className="mt-1 text-sm">{sprint.goal}</p> : null}
        </div>
        {next ? (
          <form action={changeSprintStatus}>
            <input type="hidden" name="projectId" value={projectId} />
            <input type="hidden" name="sprintId" value={sprint.id} />
            <input type="hidden" name="status" value={next.status} />
            <Button type="submit" variant={sprint.status === "active" ? "secondary" : undefined}>
              {next.label}
            </Button>
          </form>
        ) : null}
      </div>
      {tasks.length ? (
        <ul>
          {tasks.map((task) => (
            <TaskLine key={task.id} task={task} projectId={projectId} sprints={openSprints} />
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">Noch keine Aufgaben in diesem Sprint.</p>
      )}
    </section>
  );
}
