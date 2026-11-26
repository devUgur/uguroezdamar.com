import type { Env } from "../env.ts";

/**
 * Previews per repository (ADR 0036): one preview Worker per project, one version with a preview alias per
 * branch or pull request. The URL follows from the names, so the same rule holds for every project.
 */
const DNS_LABEL = 63;
const WORKER_PREFIX = "pv-";
const MAX_WORKER_NAME = 54;

export const WRANGLER_CONFIGS = ["wrangler.jsonc", "wrangler.json", "wrangler.toml"] as const;

function slug(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

/** Name of the preview Worker of a project. */
export function previewWorkerName(projectId: string): string {
  return `${WORKER_PREFIX}${slug(projectId)}`.slice(0, MAX_WORKER_NAME).replace(/-$/, "");
}

/** Alias of one branch or pull request; short enough that `<alias>-<worker>` stays one DNS label. */
export function previewAlias(workerName: string, ref: { branch?: string; pullRequest?: number }): string {
  const raw = ref.pullRequest ? `pr-${ref.pullRequest}` : slug(ref.branch ?? "");
  if (!raw) throw new Error("Für eine Preview fehlt Branch oder Pull Request.");
  const room = DNS_LABEL - workerName.length - 1;
  const alias = raw.slice(0, Math.max(1, room)).replace(/-$/, "");
  // Wrangler wants the alias to start with a letter.
  return /^[a-z]/.test(alias) ? alias : `b${alias}`.slice(0, Math.max(1, room));
}

export function previewUrl(alias: string, workerName: string, subdomain: string): string {
  return `https://${alias}-${workerName}.${subdomain}.workers.dev`;
}

export interface Preview {
  ref: string;
  alias: string;
  url: string;
  versionId: string | null;
  status: "ready" | "failed";
  commit: string | null;
  updatedAt: number;
}

/** Records the outcome of a preview upload; one row per project and alias, the newest upload wins. */
export async function savePreview(env: Env, tenantId: string, projectId: string, preview: Omit<Preview, "updatedAt">): Promise<void> {
  await env.DB.prepare(
    `INSERT INTO previews (tenant_id, project_id, alias, ref, url, version_id, status, commit_sha)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT (tenant_id, project_id, alias) DO UPDATE SET
       ref = excluded.ref, url = excluded.url, version_id = excluded.version_id, status = excluded.status,
       commit_sha = excluded.commit_sha, updated_at = unixepoch()`,
  )
    .bind(tenantId, projectId, preview.alias, preview.ref, preview.url, preview.versionId, preview.status, preview.commit)
    .run();
}

export async function listPreviews(env: Env, tenantId: string, projectId: string): Promise<Preview[]> {
  const { results } = await env.DB.prepare(
    `SELECT ref, alias, url, version_id AS versionId, status, commit_sha AS "commit", updated_at AS updatedAt
       FROM previews WHERE tenant_id = ? AND project_id = ? ORDER BY updated_at DESC LIMIT 50`,
  )
    .bind(tenantId, projectId)
    .all<Preview>();
  return results;
}

/** Version id wrangler prints after `versions upload`. */
export function versionIdFrom(output: string): string | null {
  return output.match(/Worker Version ID:\s*([0-9a-f-]{36})/i)?.[1] ?? null;
}
