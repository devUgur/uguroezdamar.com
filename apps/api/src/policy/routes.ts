import type { Caller } from "../auth.ts";
import type { Env } from "../env.ts";
import { emit } from "../events.ts";
import { AUTONOMY_LEVELS, CLASSES, DEFAULT_AUTONOMY } from "./catalog.ts";
import { isAutonomyLevel, listProjectPolicies, POLICY_VERSION, saveProjectPolicy } from "./engine.ts";

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } });
}

/**
 * The policy engine over HTTP (ADR 0040, P2):
 * - GET  /api/policies                 catalog, levels and every project's level
 * - PUT  /api/projects/:id/policy      set a project's level (owner: organization:write), with version check
 * - GET  /api/policy/decisions         the log of decisions about writing actions, newest first
 */
export async function handlePolicies(request: Request, env: Env, caller: Caller, path: string): Promise<Response | null> {
  if (path === "/api/policies" && request.method === "GET") {
    return json({
      version: POLICY_VERSION,
      levels: AUTONOMY_LEVELS,
      defaultLevel: DEFAULT_AUTONOMY,
      classes: Object.entries(CLASSES).map(([id, rule]) => ({ id, label: rule.label, levels: rule.levels, hard: Boolean(rule.hard) })),
      projects: await listProjectPolicies(env.DB, caller.tenantId),
    });
  }

  const match = path.match(/^\/api\/projects\/([a-z0-9-]{1,60})\/policy$/);
  if (match && request.method === "PUT") {
    if (!caller.scopes.includes("organization:write")) return json({ error: "Nur der Owner legt die Autonomie eines Projekts fest." }, 403);
    const projectId = match[1] ?? "";
    const input = (await request.json().catch(() => ({}))) as { level?: unknown; version?: unknown };
    if (!isAutonomyLevel(input.level)) return json({ error: `Autonomie muss eine von ${AUTONOMY_LEVELS.join(", ")} sein.` }, 400);
    const version = Number(input.version ?? 0);
    if (!Number.isInteger(version) || version < 0) return json({ error: "Ungültige Version." }, 400);
    const project = await env.DB.prepare("SELECT 1 FROM projects WHERE tenant_id = ? AND id = ? AND status = 'active'").bind(caller.tenantId, projectId).first();
    if (!project) return json({ error: "Projekt nicht gefunden." }, 404);
    const saved = await saveProjectPolicy(env.DB, caller.tenantId, projectId, input.level, version, caller.actor);
    if (!saved) return json({ error: "Die Autonomie wurde gerade anders geändert. Bitte neu laden." }, 409);
    await emit(env, { tenantId: caller.tenantId, projectId, type: "project_policy_changed", data: { autonomy: saved.level, version: saved.version, by: caller.actor } });
    return json(saved);
  }

  if (path === "/api/policy/decisions" && request.method === "GET") {
    const params = new URL(request.url).searchParams;
    const projectId = params.get("project");
    const limit = Math.min(Math.max(Number(params.get("limit") ?? 50) || 50, 1), 200);
    const { results } = await env.DB.prepare(
      `SELECT id, run_id AS runId, thread_id AS threadId, agent_id AS agentId, project_id AS projectId, tool, action_class AS actionClass, level,
              decision, reason, detail, policy_version AS policyVersion, approval_id AS approvalId, ts
         FROM policy_decisions WHERE tenant_id = ? AND (? IS NULL OR project_id = ?) ORDER BY ts DESC, id DESC LIMIT ?`,
    )
      .bind(caller.tenantId, projectId, projectId, limit)
      .all();
    return json(results);
  }

  return null;
}
