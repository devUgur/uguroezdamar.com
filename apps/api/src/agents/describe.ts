import { APPROVAL_TTL_SECONDS, PROTECTED_PATHS } from "../approvals.ts";
import type { Env } from "../env.ts";
import { secret } from "../env.ts";
import { spentTodayFromLedger } from "../usage/ledger.ts";
import { parseList } from "../organization/catalog.ts";
import { ModelRouter } from "../models/router.ts";
import { PRIOR_MESSAGES } from "../runtime/context.ts";
import { loadAgentSettings, stepsOf } from "./settings.ts";
import { EXTERNAL_SUBREQUESTS_PER_STAGE } from "../runtime/budget.ts";
import { STALE_RUN_MS } from "../runtime/limits.ts";
import { BRANCH_PREFIX, WORK_BRANCH } from "../tools/github.ts";
import { toolsByName } from "../tools/registry.ts";
import { AGENTS } from "./registry.ts";

/** Names of the secrets an agent depends on. Only whether they are set is reported, never a value. */
const CREDENTIALS = [
  { name: "AGENT_GITHUB_TOKEN", purpose: "Repo lesen, Commits und Pull Requests (Rückfall zur GitHub App)" },
  { name: "AGENT_GH_APP_ID", purpose: "GitHub App: Kennung" },
  { name: "AGENT_GH_APP_PRIVATE_KEY", purpose: "GitHub App: privater Schlüssel" },
  { name: "AGENT_GH_WEBHOOK_SECRET", purpose: "GitHub App: Webhook-Signatur" },
  { name: "GEMINI_API_KEY", purpose: "Gemini-Modelle" },
  { name: "MODAL_LLM_API_KEY", purpose: "Eigene Modelle auf Modal" },
  { name: "PROVIDER_KEYS_SECRET", purpose: "Verschlüsselt die im Portal hinterlegten Modellschlüssel" },
  { name: "AGENT_CF_PREVIEW_TOKEN", purpose: "Preview-Uploads der Workstations (nur im Worker, nie im Container)" },
] as const;

const DEFAULT_PROJECT = "uguroezdamar";

interface OrganizationRow {
  definition_id: string | null;
  runtime_key: string | null;
  definition_version: number | null;
  role_id: string | null;
  role_name: string | null;
  role_purpose: string | null;
  responsibilities: string | null;
  capabilities: string | null;
  role_version: number | null;
  department_name: string | null;
}

interface WorkRow {
  id: string;
  title: string;
  status: string;
  priority: string;
  updated_at: number;
  thread_id: string | null;
}

/** Statuses that still need attention; done and backlog items stay out of the sheet's short list. */
const ACTIVE_TASKS = "('ready', 'in_progress', 'review', 'qa', 'blocked')";

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
export async function describeAgent(env: Env, tenantId: string, agentId: string) {
  const definition = AGENTS[agentId];
  if (!definition) return null;

  const [router, settings] = await Promise.all([ModelRouter.load(env, tenantId), loadAgentSettings(env, tenantId, agentId)]);
  const [row, project, spent, threads, pendingApprovals, memories, totals, organization, taskCounts, activeTasks] = await Promise.all([
    env.DB.prepare("SELECT role, daily_budget_usd, desk_x, desk_y FROM agents WHERE id = ?")
      .bind(agentId)
      .first<{ role: string; daily_budget_usd: number; desk_x: number | null; desk_y: number | null }>(),
    env.DB.prepare("SELECT id, name, repo FROM projects WHERE tenant_id = ? AND id = ?")
      .bind(tenantId, DEFAULT_PROJECT)
      .first<{ id: string; name: string; repo: string | null }>(),
    spentTodayFromLedger(env, tenantId, agentId),
    count(env, "SELECT COUNT(*) AS n FROM threads WHERE tenant_id = ? AND agent_id = ? AND archived = 0", tenantId, agentId),
    count(env, "SELECT COUNT(*) AS n FROM approvals WHERE tenant_id = ? AND agent_id = ? AND status = 'pending' AND (expires_at IS NULL OR expires_at > unixepoch())", tenantId, agentId),
    count(env, "SELECT COUNT(*) AS n FROM memories WHERE tenant_id = ? AND project_id = ?", tenantId, DEFAULT_PROJECT),
    env.DB.prepare("SELECT COUNT(*) AS events, COALESCE(SUM(cost_usd), 0) AS cost FROM events WHERE tenant_id = ? AND agent_id = ?")
      .bind(tenantId, agentId)
      .first<{ events: number; cost: number }>(),
    env.DB.prepare(
      `SELECT a.definition_id, d.runtime_key, d.version AS definition_version, r.id AS role_id, r.name AS role_name,
              r.purpose AS role_purpose, r.responsibilities, r.capabilities, r.version AS role_version, dep.name AS department_name
         FROM agents a
         LEFT JOIN agent_definitions d ON d.id = a.definition_id
         LEFT JOIN role_profiles r ON r.id = d.role_id
         LEFT JOIN departments dep ON dep.id = r.department_id
        WHERE a.id = ?`,
    )
      .bind(agentId)
      .first<OrganizationRow>(),
    env.DB.prepare("SELECT status, COUNT(*) AS n FROM tasks WHERE tenant_id = ? AND agent_id = ? GROUP BY status")
      .bind(tenantId, agentId)
      .all<{ status: string; n: number }>(),
    env.DB.prepare(
      `SELECT t.id, t.title, t.status, t.priority, t.updated_at,
              (SELECT th.id FROM threads th WHERE th.task_id = t.id AND th.archived = 0 ORDER BY th.updated_at DESC LIMIT 1) AS thread_id
         FROM tasks t WHERE t.tenant_id = ? AND t.agent_id = ? AND t.status IN ${ACTIVE_TASKS} ORDER BY t.updated_at DESC LIMIT 5`,
    )
      .bind(tenantId, agentId)
      .all<WorkRow>(),
  ]);

  const repo = project?.repo ?? env.DEFAULT_REPO;
  return {
    id: definition.id,
    name: definition.name,
    role: row?.role ?? "",
    summary: definition.summary,
    desk: { x: row?.desk_x ?? 0, y: row?.desk_y ?? 0 },
    model: {
      alias: definition.modelAlias,
      // The employee's own model comes first, then the role chain (with the tenant's role default).
      chain: [
        ...(settings.model && router.offers(settings.model)
          ? [{ provider: settings.model.provider, providerLabel: router.catalog().providers.find((provider) => provider.id === settings.model?.provider)?.label ?? settings.model.provider, model: settings.model.model, available: true }]
          : []),
        ...router.chain(definition.modelAlias).filter((target) => !(settings.model && target.provider === settings.model.provider && target.model === settings.model.model)),
      ],
    },
    settings,
    tools: toolsByName(definition.tools).map((tool) => ({
      name: tool.spec.name,
      description: tool.spec.description,
      requiresApproval: Boolean(tool.requiresApproval),
      inputs: inputsOf(tool.spec.parameters),
    })),
    organization: organization?.role_id
      ? {
          department: organization.department_name ?? "",
          role: {
            id: organization.role_id,
            name: organization.role_name ?? organization.role_id,
            purpose: organization.role_purpose ?? "",
            responsibilities: parseList(organization.responsibilities ?? "[]"),
            capabilities: parseList(organization.capabilities ?? "[]"),
            version: organization.role_version ?? 1,
          },
          definition: { id: organization.definition_id ?? "", runtimeKey: organization.runtime_key ?? "", version: organization.definition_version ?? 1 },
        }
      : null,
    work: {
      byStatus: Object.fromEntries(taskCounts.results.map((entry) => [entry.status, entry.n])) as Record<string, number>,
      active: activeTasks.results.map((task) => ({
        id: task.id,
        title: task.title,
        status: task.status,
        priority: task.priority,
        updatedAt: task.updated_at,
        threadId: task.thread_id,
      })),
    },
    prompt: definition.systemPrompt({ repo, projectName: project?.name ?? DEFAULT_PROJECT, memories: [] }),
    limits: {
      maxSteps: stepsOf(settings),
      subrequestsPerStage: EXTERNAL_SUBREQUESTS_PER_STAGE,
      historyMessages: PRIOR_MESSAGES,
      staleRunMinutes: STALE_RUN_MS / 60_000,
      approvalHours: APPROVAL_TTL_SECONDS / 3600,
      dailyBudgetUsd: settings.dailyBudgetUsd ?? row?.daily_budget_usd ?? 0.5,
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
