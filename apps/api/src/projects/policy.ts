import type { Env } from "../env.ts";

/**
 * Which model providers may see a project's content (ADR 0033).
 * - strict: only providers whose API terms exclude evaluating the content (Claude, OpenAI, Workers AI, Modal, …).
 * - open: every provider with a key, including those that may evaluate (DeepSeek, Kimi, Gemini Free, …).
 * Without an explicit choice a private repository is strict and a public one open.
 */
export const MODEL_POLICIES = ["strict", "open"] as const;
export type ModelPolicy = (typeof MODEL_POLICIES)[number];

export function effectivePolicy(row: { visibility: string | null; model_policy?: string | null }): ModelPolicy {
  if (row.model_policy === "strict" || row.model_policy === "open") return row.model_policy;
  return row.visibility === "public" ? "open" : "strict";
}

/**
 * True when any of these repositories must stay with providers that do not evaluate content: a registered project
 * with a strict policy, or a private repository that is no project of this tenant (nobody decided otherwise).
 */
export async function anyStrict(env: Env, tenantId: string, repos: string[]): Promise<boolean> {
  if (!repos.length) return false;
  const { results } = await env.DB.prepare("SELECT lower(repo) AS repo, visibility, model_policy FROM projects WHERE tenant_id = ? AND status = 'active' AND repo IS NOT NULL")
    .bind(tenantId)
    .all<{ repo: string; visibility: string; model_policy: string | null }>();
  const byRepo = new Map(results.map((row) => [row.repo, effectivePolicy(row)]));
  return repos.some((repo) => (byRepo.get(repo.toLowerCase()) ?? "strict") === "strict");
}

export async function setProjectPolicy(env: Env, tenantId: string, projectId: string, policy: ModelPolicy | null): Promise<boolean> {
  const result = await env.DB.prepare("UPDATE projects SET model_policy = ? WHERE tenant_id = ? AND id = ? AND status = 'active'").bind(policy, tenantId, projectId).run();
  return (result.meta.changes ?? 0) > 0;
}
