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

/** A preview URL of a branch or pull request (GET /api/projects/:id/previews, ADR 0035). */
export interface Preview {
  ref: string;
  alias: string;
  url: string;
  versionId: string | null;
  status: "ready" | "failed";
  commit: string | null;
  updatedAt: number;
}

/** Previews of a project; `available` is false until workstations and the preview token are set up. */
export interface ProjectPreviews {
  available: boolean;
  previews: Preview[];
}

export interface ProjectOverview {
  project: Project | null;
  sprints: Sprint[];
  tasks: ProjectTask[];
  previews: ProjectPreviews;
  error: string | null;
}
