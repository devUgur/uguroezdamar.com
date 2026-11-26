/** Shapes of the agent API's project routes (apps/api/src/projects, apps/api/src/index.ts). */
export interface Project {
  id: string;
  name: string;
  repo: string | null;
  domain: string | null;
  status: string;
  visibility: "public" | "private";
  defaultBranch: string;
  writeMode: "dev-first" | "pr-only";
  /** Which model providers may see the content (ADR 0033): strict = only those without data evaluation. */
  modelPolicy: "strict" | "open";
  /** False while the policy just follows the repository's visibility. */
  modelPolicyExplicit: boolean;
}

/** A repository the agent token can see; `projectId` is set once it is registered as a project. */
export interface GithubRepository {
  fullName: string;
  name: string;
  owner: string;
  private: boolean;
  defaultBranch: string;
  archived: boolean;
  fork: boolean;
  description: string | null;
  pushedAt: string | null;
  projectId: string | null;
}

/** How the API reaches GitHub (GET /api/github/status, ADR 0031). */
export interface GithubStatus {
  mode: "app" | "token" | "none";
  tokenConfigured: boolean;
  installations: { installationId: number; account: string; selection: string; allowed: boolean }[];
  /** Accounts allowed by hand (the owner's GITHUB_OWNERS) that have no recorded installation. */
  configuredOnly: string[];
}

export type SprintStatus = "planned" | "active" | "done";

/** A sprint of one project (GET /api/projects/:id/sprints). */
export interface Sprint {
  id: string;
  projectId: string;
  name: string;
  goal: string | null;
  status: SprintStatus;
  startsAt: number | null;
  endsAt: number | null;
  tasksTotal: number;
  tasksDone: number;
  pointsTotal: number | null;
}

export type TaskStatus = "backlog" | "ready" | "in_progress" | "review" | "qa" | "blocked" | "done";

/** The part of a task the project page shows (GET /api/tasks?project=…). */
export interface ProjectTask {
  id: string;
  projectId: string | null;
  sprintId: string | null;
  title: string;
  status: TaskStatus;
  priority: "low" | "normal" | "high" | "urgent";
  storyPoints: number | null;
  agent: { id: string; name: string } | null;
  threadId: string | null;
}

export interface ProjectOverview {
  project: Project | null;
  sprints: Sprint[];
  tasks: ProjectTask[];
  error: string | null;
}

/** Knowledge index of a project (agent API: GET /api/projects/:id/knowledge). */
export interface KnowledgeStatus {
  sources: number;
  chunks: number;
  embedded: number;
  lastIndexedAt: number | null;
  job: { status: "queued" | "running" | "done" | "failed"; indexed: number; skipped: number; queued: number; vectorsMissing: boolean; startedAt: number; finishedAt: number | null; error: string | null } | null;
}

export interface KnowledgeHit {
  chunkId: string;
  source: string;
  heading: string | null;
  text: string;
  via: ("text" | "vector")[];
}

export interface WorkingMemoryEntry {
  agentId: string;
  agent: string;
  content: string;
  version: number;
  updatedAt: number;
}

export interface ProjectKnowledge {
  status: KnowledgeStatus | null;
  memory: WorkingMemoryEntry[];
  query: string;
  hits: KnowledgeHit[];
  error: string | null;
}
