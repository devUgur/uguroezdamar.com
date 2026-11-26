export const WORK_STATUSES = ["backlog", "ready", "in_progress", "review", "qa", "blocked", "done"] as const;
export type WorkStatus = (typeof WORK_STATUSES)[number];
export type WorkPriority = "low" | "normal" | "high" | "urgent";

export interface WorkTask {
  id: string;
  projectId: string | null;
  agent: { id: string; name: string; role: string } | null;
  threadId: string | null;
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
  completionNote: string | null;
  completedBy: string | null;
  completedAt: number | null;
  githubIssue: { number: number; url: string | null; state: string | null } | null;
  latestReview: {
    id: string;
    status: "running" | "completed" | "failed" | "cancelled";
    verdict: "pass" | "changes_requested" | "needs_human" | null;
    summary: string | null;
    findings: string[];
    evidence: string[];
    error: string | null;
    threadId: string | null;
    createdAt: number;
  } | null;
}
