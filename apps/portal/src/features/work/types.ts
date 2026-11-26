export const WORK_STATUSES = ["backlog", "ready", "in_progress", "review", "qa", "blocked", "done"] as const;
export type WorkStatus = (typeof WORK_STATUSES)[number];
export type WorkPriority = "low" | "normal" | "high" | "urgent";

export interface WorkTask {
  id: string;
  projectId: string | null;
  agent: { id: string; name: string; role: string } | null;
  parentId: string | null;
  title: string;
  description: string | null;
  acceptanceCriteria: string | null;
  input: string | null;
  output: string | null;
  status: WorkStatus;
  priority: WorkPriority;
  storyPoints: number | null;
  createdBy: string | null;
  createdAt: number;
  updatedAt: number;
}
