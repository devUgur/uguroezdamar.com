import { run } from "./exec.ts";
import type { Stage } from "./stages.ts";

export type App = "site" | "portal";

/** The Vercel project of each app; both build from this repository (ADR 0020). */
export const VERCEL_PROJECTS: Record<App, { name: string; rootDirectory: string }> = {
  site: { name: "uguroezdamar-com", rootDirectory: "apps/site" },
  portal: { name: "uguroezdamar-portal", rootDirectory: "apps/portal" },
};

/** A stage's secrets go to exactly one Vercel environment: previews run on `dev`. */
export const VERCEL_TARGET: Record<Stage, "preview" | "production"> = { dev: "preview", prod: "production" };

export interface ApiResult<T> {
  ok: boolean;
  data?: T;
  error?: string;
}

/**
 * Calls the Vercel REST API through the signed-in `vercel` CLI. A body goes over stdin, so a
 * secret value in it never becomes a process argument. Errors carry Vercel's message only.
 */
export function vercelApi<T>(path: string, options: { method?: string; body?: unknown } = {}): ApiResult<T> {
  const args = ["api", path, "--raw"];
  if (options.method) args.push("-X", options.method);
  if (options.body !== undefined) args.push("--input", "-");
  const { stdout, stderr } = run("vercel", args, {
    capture: true,
    input: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
  const start = stdout.search(/[[{]/);
  let data: unknown;
  try {
    data = start === -1 ? undefined : JSON.parse(stdout.slice(start));
  } catch {
    data = undefined;
  }
  const failure = (data as { error?: { message?: string } } | undefined)?.error;
  if (failure) return { ok: false, error: failure.message ?? "request refused" };
  if (data === undefined) {
    const line = stderr.split("\n").map((entry) => entry.trim()).filter(Boolean).at(-1);
    return { ok: false, error: line ?? "no answer from the Vercel CLI (is `vercel` installed and signed in?)" };
  }
  return { ok: true, data: data as T };
}

export interface VercelProject {
  id: string;
  name: string;
  rootDirectory: string | null;
  nodeVersion: string;
  autoAssignCustomDomains?: boolean;
  ssoProtection?: { deploymentType: string } | null;
  protectionBypass?: Record<string, unknown>;
  link?: { org: string; repo: string; productionBranch: string };
  env?: Array<{ key: string; target: string | string[]; type: string }>;
  targets?: { production?: { alias?: string[]; meta?: { githubCommitSha?: string } } | null };
}

export const getProject = (app: App) => vercelApi<VercelProject>(`/v9/projects/${VERCEL_PROJECTS[app].name}`);

/** Names of the variables a project has in one environment. Values are never requested. */
export function envNames(project: VercelProject, target: string): string[] {
  return (project.env ?? [])
    .filter((entry) => [entry.target].flat().includes(target))
    .map((entry) => entry.key)
    .sort();
}
