import { Button } from "@ugur/ui";
import { moveTaskToSprint } from "../actions";
import type { ProjectTask, Sprint } from "../types";
import { officeUrl } from "@/src/adapters/office";

export const STATUS_LABEL: Record<ProjectTask["status"], string> = {
  backlog: "Backlog",
  ready: "Bereit",
  in_progress: "In Arbeit",
  review: "Review",
  qa: "QA",
  blocked: "Blockiert",
  done: "Erledigt",
};

interface TaskLineProps {
  task: ProjectTask;
  projectId: string;
  /** Sprints the task may move to; finished ones are left out by the caller. */
  sprints: Sprint[];
}

/** One task: status, points, agent, and where it is planned. Details and runs stay on the board (/work). */
export function TaskLine({ task, projectId, sprints }: TaskLineProps) {
  return (
    <li className="flex flex-wrap items-center gap-3 border-b border-border py-2 text-sm last:border-b-0">
      <span className="w-20 shrink-0 font-mono text-xs text-muted-foreground">{STATUS_LABEL[task.status]}</span>
      <span className="min-w-0 flex-1 truncate">
        {task.title}
        {task.priority === "urgent" || task.priority === "high" ? <span className="ml-2 text-xs text-destructive">{task.priority === "urgent" ? "dringend" : "hoch"}</span> : null}
      </span>
      <span className="text-xs text-muted-foreground">
        {task.storyPoints ? `${task.storyPoints} SP` : ""}
        {task.agent ? ` · ${task.agent.name}` : ""}
      </span>
      {task.threadId ? (
        <a href={officeUrl(`/chat/${task.threadId}`)} className="text-xs underline underline-offset-2">
          Lauf
        </a>
      ) : null}
      {task.status !== "done" ? (
        <form action={moveTaskToSprint} className="flex items-center gap-1">
          <input type="hidden" name="projectId" value={projectId} />
          <input type="hidden" name="taskId" value={task.id} />
          <label className="sr-only" htmlFor={`sprint-${task.id}`}>
            Sprint für {task.title}
          </label>
          <select id={`sprint-${task.id}`} name="sprintId" defaultValue={task.sprintId ?? ""} className="h-8 rounded-md border border-input bg-background px-2 text-xs">
            <option value="">Backlog</option>
            {sprints.map((sprint) => (
              <option key={sprint.id} value={sprint.id}>
                {sprint.name}
              </option>
            ))}
          </select>
          <Button type="submit" variant="secondary" className="h-8 px-2 text-xs">
            Verschieben
          </Button>
        </form>
      ) : null}
    </li>
  );
}
