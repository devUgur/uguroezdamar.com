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
