import Link from "next/link";
import { cn } from "@ugur/core";
import type { OfficeTask, ThreadProject } from "../../types";
import { byColumn, COLUMNS, projectSummaries, type ProjectSummary } from "./board";

interface TaskBoardProps {
  tasks: OfficeTask[];
  projects: ThreadProject[];
  /** Company level: cards name their project and a summary per project leads the board. */
  company: boolean;
  /** Picks a project from the company summary. */
  onPickProject: (projectId: string) => void;
}

const PRIORITY_LABEL: Record<OfficeTask["priority"], string | null> = { urgent: "dringend", high: "hoch", normal: null, low: "niedrig" };

function TaskCard({ task, projectName }: { task: OfficeTask; projectName: string | null }) {
  const priority = PRIORITY_LABEL[task.priority];
  const body = (
    <>
      {projectName ? <span className="truncate text-[11px] uppercase tracking-wide text-muted-foreground">{projectName}</span> : null}
      <span className="line-clamp-3 text-sm leading-snug">{task.title}</span>
      <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
        {task.agent ? <span>{task.agent.name}</span> : <span>nicht zugewiesen</span>}
        {task.storyPoints ? <span className="font-mono">{task.storyPoints} SP</span> : null}
        {priority ? <span className={cn("rounded-full border px-1.5", task.priority === "urgent" || task.priority === "high" ? "border-destructive text-destructive" : "border-border")}>{priority}</span> : null}
      </span>
    </>
  );
  const className = "flex flex-col gap-1 rounded-md border border-border bg-card p-2.5 text-left";
  return task.threadId ? (
    <Link href={`/chat/${task.threadId}`} className={cn(className, "transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring")}>
      {body}
    </Link>
  ) : (
    <div className={className}>{body}</div>
  );
}

function ProjectRow({ summary, onPick }: { summary: ProjectSummary; onPick: () => void }) {
  return (
    <button
      type="button"
      onClick={onPick}
      className="flex min-w-48 flex-col gap-1.5 rounded-md border border-border bg-card p-3 text-left transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <span className="flex items-baseline justify-between gap-2">
        <span className="truncate text-sm font-medium">{summary.project.name}</span>
        <span className="font-mono text-xs text-muted-foreground">{summary.open} offen</span>
      </span>
      <span className="flex flex-wrap gap-x-2 text-xs text-muted-foreground">
        {COLUMNS.filter((column) => column.status !== "done" && summary.counts[column.status]).map((column) => (
          <span key={column.status} className={cn(column.status === "blocked" && "text-destructive")}>
            {column.label} {summary.counts[column.status]}
          </span>
        ))}
      </span>
    </button>
  );
}

/** The board: one column per status. On the company level a row of projects leads it, classified by their open work. */
export function TaskBoard({ tasks, projects, company, onPickProject }: TaskBoardProps) {
  const columns = byColumn(tasks);
  const names = new Map(projects.map((project) => [project.id, project.name]));
  const summaries = company ? projectSummaries(tasks, projects) : [];

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      {company && summaries.length ? (
        <div className="flex gap-2 overflow-x-auto pb-1" aria-label="Projekte">
          {summaries.map((summary) => (
            <ProjectRow key={summary.project.id} summary={summary} onPick={() => onPickProject(summary.project.id)} />
          ))}
        </div>
      ) : null}

      <div className="grid min-h-0 flex-1 auto-cols-[minmax(13rem,1fr)] grid-flow-col gap-3 overflow-x-auto">
        {COLUMNS.map((column) => (
          <section key={column.status} aria-label={column.label} className="flex min-h-0 flex-col gap-2 rounded-lg bg-muted p-2">
            <header className="flex items-baseline justify-between px-1">
              <h3 className={cn("text-xs font-medium uppercase tracking-wide", column.status === "blocked" && columns.blocked.length ? "text-destructive" : "text-muted-foreground")}>{column.label}</h3>
              <span className="font-mono text-xs text-muted-foreground">{columns[column.status].length}</span>
            </header>
            <div className="flex min-h-0 flex-col gap-2 overflow-y-auto">
              {columns[column.status].map((task) => (
                <TaskCard key={task.id} task={task} projectName={company ? (task.projectId ? (names.get(task.projectId) ?? task.projectId) : "ohne Projekt") : null} />
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
