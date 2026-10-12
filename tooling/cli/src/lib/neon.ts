import { run } from "./exec.ts";

/** One Neon project for this product; its branches are the stages. */
export const NEON_PROJECT_NAME = "uguroezdamar.com";
export const NEON_REGION = "aws-eu-central-1";

const neon = (args: string[]) => run("neon", args, { capture: true });

function json<T>(args: string[]): T | null {
  const { code, stdout } = neon([...args, "--output", "json"]);
  if (code !== 0) return null;
  try {
    return JSON.parse(stdout) as T;
  } catch {
    return null;
  }
}

export const neonLoggedIn = () => neon(["me", "--output", "json"]).code === 0;

type Named = { id: string; name: string };

/** The CLI returns a bare list in some versions and a wrapped one in others. */
const list = (data: unknown, key: string): Named[] => {
  if (Array.isArray(data)) return data as Named[];
  const wrapped = (data as Record<string, unknown> | null)?.[key];
  return Array.isArray(wrapped) ? (wrapped as Named[]) : [];
};

/** Needed when the account belongs to an organization; `NEON_ORG_ID` overrides the lookup. */
export function orgArgs(): string[] {
  if (process.env.NEON_ORG_ID) return ["--org-id", process.env.NEON_ORG_ID];
  const orgs = list(json(["orgs", "list"]), "organizations");
  return orgs.length === 1 && orgs[0] ? ["--org-id", orgs[0].id] : [];
}

export function findProject(org: string[]): Named | null | undefined {
  const data = json<unknown>(["projects", "list", ...org]);
  if (data === null) return undefined;
  return list(data, "projects").find((project) => project.name === NEON_PROJECT_NAME) ?? null;
}

export function createProject(org: string[]): string | null {
  const data = json<{ project?: { id?: string }; id?: string }>([
    "projects",
    "create",
    "--name",
    NEON_PROJECT_NAME,
    "--region-id",
    NEON_REGION,
    "--no-secrets",
    ...org,
  ]);
  return data?.project?.id ?? data?.id ?? null;
}

type Branch = Named & { default?: boolean; primary?: boolean };

export function listBranches(projectId: string): Branch[] | null {
  const data = json<unknown>(["branches", "list", "--project-id", projectId]);
  return data === null ? null : (list(data, "branches") as Branch[]);
}

export const renameBranch = (projectId: string, from: string, to: string) =>
  neon(["branches", "rename", from, to, "--project-id", projectId]).code === 0;

export const createBranch = (projectId: string, name: string, parent: string) =>
  neon(["branches", "create", "--name", name, "--parent", parent, "--project-id", projectId, "--no-secrets"])
    .code === 0;

/** A connection string, captured in memory. It carries the role password: never print it. */
export function connectionString(projectId: string, branch: string, pooled: boolean): string | null {
  const { code, stdout } = neon([
    "connection-string",
    branch,
    "--project-id",
    projectId,
    ...(pooled ? ["--pooled"] : []),
  ]);
  const url = stdout.trim().split(/\s+/).at(-1) ?? "";
  return code === 0 && /^postgres(ql)?:\/\//.test(url) ? url : null;
}
