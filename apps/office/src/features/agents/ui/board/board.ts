import { TASK_STATUSES, type OfficeScope, type OfficeTask, type TaskStatus, type ThreadProject } from "../../types";

/** The columns of the board, in the order work flows through them. */
export const COLUMNS: { status: TaskStatus; label: string }[] = [
  { status: "backlog", label: "Backlog" },
  { status: "ready", label: "Ready" },
  { status: "in_progress", label: "In Arbeit" },
  { status: "review", label: "Code Review" },
  { status: "qa", label: "QA / Test" },
  { status: "blocked", label: "Blockiert" },
  { status: "done", label: "Erledigt" },
];

export const STATUS_LABEL = Object.fromEntries(COLUMNS.map((column) => [column.status, column.label])) as Record<TaskStatus, string>;

/** Done work stays on the board for two weeks; older items live in the portal's board. */
const DONE_WINDOW_MS = 14 * 24 * 60 * 60 * 1000;
const PRIORITY_ORDER: Record<OfficeTask["priority"], number> = { urgent: 0, high: 1, normal: 2, low: 3 };

export function tasksInScope(tasks: OfficeTask[], scope: OfficeScope, now = Date.now()): OfficeTask[] {
  return tasks.filter((task) => (scope === null || task.projectId === scope) && (task.status !== "done" || now - task.updatedAt * 1000 < DONE_WINDOW_MS));
}

export type StatusCounts = Record<TaskStatus, number>;

export function countByStatus(tasks: OfficeTask[]): StatusCounts {
  const counts = Object.fromEntries(TASK_STATUSES.map((status) => [status, 0])) as StatusCounts;
  for (const task of tasks) counts[task.status] += 1;
  return counts;
}

export function byColumn(tasks: OfficeTask[]): Record<TaskStatus, OfficeTask[]> {
  const columns = Object.fromEntries(TASK_STATUSES.map((status) => [status, [] as OfficeTask[]])) as Record<TaskStatus, OfficeTask[]>;
  for (const task of [...tasks].sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority] || b.updatedAt - a.updatedAt)) columns[task.status].push(task);
  return columns;
}

export interface ProjectSummary {
  project: ThreadProject;
  counts: StatusCounts;
  open: number;
}

/** The company view: every project with work, most open work first; projects without any task are left out. */
export function projectSummaries(tasks: OfficeTask[], projects: ThreadProject[]): ProjectSummary[] {
  return projects
    .map((project) => {
      const counts = countByStatus(tasks.filter((task) => task.projectId === project.id));
      return { project, counts, open: TASK_STATUSES.filter((status) => status !== "done").reduce((sum, status) => sum + counts[status], 0) };
    })
    .filter((summary) => summary.open > 0 || summary.counts.done > 0)
    .sort((a, b) => b.open - a.open || a.project.name.localeCompare(b.project.name));
}
