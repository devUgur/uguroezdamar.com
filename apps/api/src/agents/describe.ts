import { APPROVAL_TTL_SECONDS, PROTECTED_PATHS } from "../approvals.ts";
import type { Env } from "../env.ts";
import { secret } from "../env.ts";
import { spentToday } from "../events.ts";
import { ModelRouter } from "../models/router.ts";
import { EXTERNAL_SUBREQUESTS_PER_STAGE } from "../runtime/budget.ts";
import { HISTORY_LIMIT, MAX_STEPS, STALE_RUN_MS } from "../runtime/limits.ts";
import { BRANCH_PREFIX, WORK_BRANCH } from "../tools/github.ts";
import { toolsByName } from "../tools/registry.ts";
import { AGENTS } from "./registry.ts";

/** Names of the secrets an agent depends on. Only whether they are set is reported, never a value. */
const CREDENTIALS = [
  { name: "AGENT_GITHUB_TOKEN", purpose: "Repo lesen, Commits und Pull Requests" },
  { name: "GEMINI_API_KEY", purpose: "Gemini-Modelle" },
  { name: "MODAL_LLM_API_KEY", purpose: "Eigene Modelle auf Modal" },
] as const;

const DEFAULT_PROJECT = "uguroezdamar";

async function count(env: Env, sql: string, ...params: string[]): Promise<number> {
  const row = await env.DB.prepare(sql).bind(...params).first<{ n: number }>();
  return row?.n ?? 0;
}

function inputsOf(parameters: Record<string, unknown>): { name: string; required: boolean }[] {
  const properties = (parameters.properties ?? {}) as Record<string, unknown>;
  const required = Array.isArray(parameters.required) ? (parameters.required as string[]) : [];
  return Object.keys(properties).map((name) => ({ name, required: required.includes(name) }));
}

/** Everything the portal's configuration sheet shows for one agent. Read-only. */
export async function describeAgent(env: Env, agentId: string) {
  const definition = AGENTS[agentId];
  if (!definition) return null;

  const router = await ModelRouter.load(env);
  const [row, project, spent, threads, pendingApprovals, memories, totals] = await Promise.all([
    env.DB.prepare("SELECT role, daily_budget_usd, desk_x, desk_y FROM agents WHERE id = ?")
      .bind(agentId)
      .first<{ role: string; daily_budget_usd: number; desk_x: number | null; desk_y: number | null }>(),
    env.DB.prepare("SELECT id, name, repo FROM projects WHERE id = ?")
      .bind(DEFAULT_PROJECT)
      .first<{ id: string; name: string; repo: string | null }>(),
    spentToday(env, agentId),
    count(env, "SELECT COUNT(*) AS n FROM threads WHERE agent_id = ? AND archived = 0", agentId),
    count(env, "SELECT COUNT(*) AS n FROM approvals WHERE agent_id = ? AND status = 'pending' AND (expires_at IS NULL OR expires_at > unixepoch())", agentId),
    count(env, "SELECT COUNT(*) AS n FROM memories WHERE project_id = ?", DEFAULT_PROJECT),
    env.DB.prepare("SELECT COUNT(*) AS events, COALESCE(SUM(cost_usd), 0) AS cost FROM events WHERE agent_id = ?")
      .bind(agentId)
      .first<{ events: number; cost: number }>(),
  ]);

  const repo = project?.repo ?? env.DEFAULT_REPO;
  return {
    id: definition.id,
    name: definition.name,
    role: row?.role ?? "",
    summary: definition.summary,
    desk: { x: row?.desk_x ?? 0, y: row?.desk_y ?? 0 },
    model: { alias: definition.modelAlias, chain: router.chain(definition.modelAlias) },
    tools: toolsByName(definition.tools).map((tool) => ({
      name: tool.spec.name,
      description: tool.spec.description,
      requiresApproval: Boolean(tool.requiresApproval),
      inputs: inputsOf(tool.spec.parameters),
    })),
    prompt: definition.systemPrompt({ repo, projectName: project?.name ?? DEFAULT_PROJECT, memories: [] }),
    limits: {
      maxSteps: MAX_STEPS,
      subrequestsPerStage: EXTERNAL_SUBREQUESTS_PER_STAGE,
      historyMessages: HISTORY_LIMIT,
      staleRunMinutes: STALE_RUN_MS / 60_000,
      approvalHours: APPROVAL_TTL_SECONDS / 3600,
      dailyBudgetUsd: row?.daily_budget_usd ?? 0.5,
      spentTodayUsd: spent,
    },
    storage: {
      environment: env.API_ENV || "production",
      project: { id: project?.id ?? DEFAULT_PROJECT, name: project?.name ?? DEFAULT_PROJECT, repo },
      database: { name: env.STORAGE.d1, region: env.STORAGE.d1Region, binding: "DB" },
      config: { name: env.STORAGE.kv, binding: "CONFIG" },
      files: { name: env.STORAGE.r2, binding: "FILES" },
      conversations: "Durable Object AgentRuntime mit eigener SQLite, ein Objekt je Thread",
    },
    data: {
      threads,
      events: totals?.events ?? 0,
      costUsdTotal: totals?.cost ?? 0,
      pendingApprovals,
      projectNotes: memories,
    },
    guardrails: {
      workBranch: WORK_BRANCH,
      agentBranchPrefix: BRANCH_PREFIX,
      neverWritesTo: "main",
      protectedPaths: PROTECTED_PATHS.map(({ label, reason }) => ({ path: label, reason })),
    },
    credentials: CREDENTIALS.map((entry) => ({ ...entry, set: Boolean(secret(env, entry.name)) })),
  };
}

export type AgentDescription = NonNullable<Awaited<ReturnType<typeof describeAgent>>>;
