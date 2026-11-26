import { AGENTS } from "./registry.ts";
import type { Caller } from "../auth.ts";
import type { Env } from "../env.ts";
import { emit } from "../events.ts";
import { ModelRouter } from "../models/router.ts";
import { MAX_STEPS } from "../runtime/limits.ts";

/**
 * Settings of one agent for one tenant (plan stage 2): the model it tries first, how hard it thinks, how many steps
 * a run may take and its daily budget. Prompt and tools stay code (ADR 0030); these are the owner's levers.
 */
export const EFFORTS = ["low", "medium", "high"] as const;
export type Effort = (typeof EFFORTS)[number];
export const STEP_RANGE = { min: 4, max: 60 } as const;
export const BUDGET_MAX_USD = 100;

export interface AgentSettings {
  model: { provider: string; model: string } | null;
  effort: Effort | null;
  maxSteps: number | null;
  dailyBudgetUsd: number | null;
  version: number;
  updatedBy: string | null;
  updatedAt: number | null;
}

const EMPTY: AgentSettings = { model: null, effort: null, maxSteps: null, dailyBudgetUsd: null, version: 0, updatedBy: null, updatedAt: null };

interface SettingsRow {
  model_provider: string | null;
  model: string | null;
  reasoning_effort: string | null;
  max_steps: number | null;
  daily_budget_usd: number | null;
  version: number;
  updated_by: string | null;
  updated_at: number;
}

export async function loadAgentSettings(env: Env, tenantId: string, agentId: string): Promise<AgentSettings> {
  const row = await env.DB.prepare("SELECT * FROM agent_settings WHERE tenant_id = ? AND agent_id = ?").bind(tenantId, agentId).first<SettingsRow>();
  if (!row) return { ...EMPTY };
  return {
    model: row.model_provider && row.model ? { provider: row.model_provider, model: row.model } : null,
    effort: EFFORTS.includes(row.reasoning_effort as Effort) ? (row.reasoning_effort as Effort) : null,
    maxSteps: row.max_steps,
    dailyBudgetUsd: row.daily_budget_usd,
    version: row.version,
    updatedBy: row.updated_by,
    updatedAt: row.updated_at,
  };
}

/** Effective step limit of a run. */
export function stepsOf(settings: AgentSettings): number {
  return settings.maxSteps ?? MAX_STEPS;
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } });
}

interface SettingsInput {
  model: { provider: string; model: string } | null;
  effort: Effort | null;
  maxSteps: number | null;
  dailyBudgetUsd: number | null;
  /** The version the owner saw; a different stored version means someone else changed it in between. */
  version: number;
}

/** GET/PUT /api/agents/:id/settings. Changing needs organization:write, which the portal grants only to the owner. */
export async function handleAgentSettings(request: Request, env: Env, caller: Caller, path: string): Promise<Response | null> {
  const match = path.match(/^\/api\/agents\/([a-z0-9-]{1,40})\/settings$/);
  if (!match) return null;
  const agentId = match[1] ?? "";
  if (!AGENTS[agentId]) return json({ error: "Unbekannter Agent" }, 404);
  if (request.method === "GET") return json(await loadAgentSettings(env, caller.tenantId, agentId));
  if (request.method !== "PUT") return json({ error: "Methode nicht erlaubt" }, 405);
  if (!caller.scopes.includes("organization:write")) return json({ error: "Nur der Owner darf Mitarbeiter einstellen." }, 403);

  let input: Partial<SettingsInput>;
  try {
    input = (await request.json()) as Partial<SettingsInput>;
  } catch {
    return json({ error: "Ungültiger JSON-Body." }, 400);
  }
  const current = await loadAgentSettings(env, caller.tenantId, agentId);
  if (input.version !== current.version) return json({ error: "Die Einstellungen wurden zwischenzeitlich geändert. Bitte neu laden." }, 409);

  const model = input.model ?? null;
  if (model) {
    const router = await ModelRouter.load(env, caller.tenantId);
    if (!router.usable(model)) return json({ error: "Dieses Modell bietet der Anbieter nicht an oder es ist kein Schlüssel hinterlegt." }, 400);
  }
  const effort = input.effort ?? null;
  if (effort !== null && !EFFORTS.includes(effort)) return json({ error: "Denkaufwand: low, medium oder high." }, 400);
  const maxSteps = input.maxSteps ?? null;
  if (maxSteps !== null && (!Number.isInteger(maxSteps) || maxSteps < STEP_RANGE.min || maxSteps > STEP_RANGE.max)) {
    return json({ error: `Schritte je Lauf: ${STEP_RANGE.min} bis ${STEP_RANGE.max}.` }, 400);
  }
  const budget = input.dailyBudgetUsd ?? null;
  if (budget !== null && (!Number.isFinite(budget) || budget < 0 || budget > BUDGET_MAX_USD)) return json({ error: `Tagesbudget: 0 bis ${BUDGET_MAX_USD} $.` }, 400);

  const result = await env.DB.prepare(
    `INSERT INTO agent_settings (tenant_id, agent_id, model_provider, model, reasoning_effort, max_steps, daily_budget_usd, version, updated_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?)
     ON CONFLICT (tenant_id, agent_id) DO UPDATE SET model_provider = excluded.model_provider, model = excluded.model,
       reasoning_effort = excluded.reasoning_effort, max_steps = excluded.max_steps, daily_budget_usd = excluded.daily_budget_usd,
       version = agent_settings.version + 1, updated_by = excluded.updated_by, updated_at = unixepoch()
     WHERE agent_settings.version = ?`,
  )
    .bind(caller.tenantId, agentId, model?.provider ?? null, model?.model ?? null, effort, maxSteps, budget, caller.actor, current.version)
    .run();
  if (!(result.meta.changes ?? 0)) return json({ error: "Die Einstellungen wurden zwischenzeitlich geändert. Bitte neu laden." }, 409);
  const saved = await loadAgentSettings(env, caller.tenantId, agentId);
  await emit(env, {
    tenantId: caller.tenantId,
    agentId,
    type: "organization_updated",
    data: { scope: "settings", entityId: agentId, version: saved.version, by: caller.actor, before: current, after: saved },
  }).catch((error) => console.error("settings event failed", error));
  return json(saved);
}
