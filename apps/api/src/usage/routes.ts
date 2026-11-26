import type { Caller } from "../auth.ts";
import type { Env } from "../env.ts";

/**
 * Read side of the usage ledger (plan stage 1): totals and breakdowns, the call and run tables, one run's trace and a
 * CSV export. Every query is scoped to the caller's tenant; filters only ever narrow it.
 */
const DAY_MS = 86_400_000;
const MAX_ROWS = 500;
/** A CSV export may hold more rows than a page. */
const MAX_EXPORT_ROWS = 10_000;
const ID = /^[A-Za-z0-9._:/@-]{1,120}$/;

export interface UsageFilter {
  from: number;
  to: number;
  projectId?: string;
  agentId?: string;
  provider?: string;
  model?: string;
  status?: string;
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } });
}

/** Reads the filter from the query string. Dates are YYYY-MM-DD (UTC) or epoch milliseconds; default the last 30 days. */
export function parseFilter(params: URLSearchParams, now = Date.now()): UsageFilter {
  const time = (value: string | null, fallback: number, endOfDay = false): number => {
    if (!value) return fallback;
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      const start = Date.parse(`${value}T00:00:00Z`);
      return Number.isFinite(start) ? start + (endOfDay ? DAY_MS - 1 : 0) : fallback;
    }
    const number = Number(value);
    return Number.isFinite(number) && number > 0 ? number : fallback;
  };
  const text = (key: string): string | undefined => {
    const value = params.get(key)?.trim();
    return value && ID.test(value) ? value : undefined;
  };
  const to = time(params.get("to"), now, true);
  const from = Math.min(time(params.get("from"), to - 30 * DAY_MS), to);
  return { from, to, projectId: text("project"), agentId: text("agent"), provider: text("provider"), model: text("model"), status: text("status") };
}

/** WHERE clause for model_calls (alias c); always tenant and time first. */
function callWhere(tenantId: string, filter: UsageFilter): { sql: string; params: unknown[] } {
  const parts = ["c.tenant_id = ?", "c.ts >= ?", "c.ts <= ?"];
  const params: unknown[] = [tenantId, filter.from, filter.to];
  const add = (column: string, value: string | undefined) => {
    if (value === undefined) return;
    parts.push(`${column} = ?`);
    params.push(value);
  };
  add("c.project_id", filter.projectId);
  add("c.agent_id", filter.agentId);
  add("c.provider", filter.provider);
  add("c.model", filter.model);
  add("c.status", filter.status);
  return { sql: parts.join(" AND "), params };
}

const SUMS = `COALESCE(SUM(c.cost_usd), 0) AS costUsd, COALESCE(SUM(c.tokens_in), 0) AS tokensIn, COALESCE(SUM(c.tokens_out), 0) AS tokensOut,
  COALESCE(SUM(c.cache_read_tokens), 0) AS cacheReadTokens, COUNT(*) AS calls, SUM(CASE WHEN c.status = 'error' THEN 1 ELSE 0 END) AS errors,
  CAST(AVG(c.latency_ms) AS INTEGER) AS avgLatencyMs`;

export async function usageSummary(env: Env, tenantId: string, filter: UsageFilter) {
  const where = callWhere(tenantId, filter);
  const group = async (key: string, label: string) =>
    (
      await env.DB.prepare(`SELECT ${key} AS key, ${label} AS label, ${SUMS} FROM model_calls c WHERE ${where.sql} GROUP BY ${key} ORDER BY costUsd DESC, calls DESC LIMIT 50`)
        .bind(...where.params)
        .all()
    ).results;
  const [totals, byDay, byAgent, byModel, byProject, byProvider, runs] = await Promise.all([
    env.DB.prepare(`SELECT ${SUMS} FROM model_calls c WHERE ${where.sql}`).bind(...where.params).first(),
    env.DB.prepare(`SELECT date(c.ts / 1000, 'unixepoch') AS day, ${SUMS} FROM model_calls c WHERE ${where.sql} GROUP BY day ORDER BY day`).bind(...where.params).all(),
    group("c.agent_id", "COALESCE((SELECT name FROM agents a WHERE a.id = c.agent_id), c.agent_id)"),
    group("c.provider || '/' || c.model", "c.provider || '/' || c.model"),
    group("c.project_id", "COALESCE((SELECT name FROM projects p WHERE p.tenant_id = c.tenant_id AND p.id = c.project_id), c.project_id)"),
    group("c.provider", "c.provider"),
    env.DB.prepare(
      `SELECT COUNT(*) AS runs, SUM(CASE WHEN status = 'running' THEN 1 ELSE 0 END) AS running FROM runs
        WHERE tenant_id = ? AND started_at >= ? AND started_at <= ? ${filter.projectId ? "AND project_id = ?" : ""} ${filter.agentId ? "AND agent_id = ?" : ""}`,
    )
      .bind(tenantId, filter.from, filter.to, ...(filter.projectId ? [filter.projectId] : []), ...(filter.agentId ? [filter.agentId] : []))
      .first(),
  ]);
  return { filter, totals, runs, byDay: byDay.results, byAgent, byModel, byProject, byProvider, budgets: await budgets(env, tenantId) };
}

/** Today's spend of every active agent against its daily budget; warn from 80 percent. */
async function budgets(env: Env, tenantId: string) {
  const startOfDay = new Date();
  startOfDay.setUTCHours(0, 0, 0, 0);
  const { results } = await env.DB.prepare(
    `/* tenant:platform */ SELECT a.id AS agentId, a.name AS agent, a.daily_budget_usd AS budgetUsd,
       (SELECT COALESCE(SUM(c.cost_usd), 0) FROM model_calls c WHERE c.tenant_id = ? AND c.agent_id = a.id AND c.ts >= ?) AS spentUsd
       FROM agents a WHERE a.active = 1 ORDER BY a.created_at`,
  )
    .bind(tenantId, startOfDay.getTime())
    .all<{ agentId: string; agent: string; budgetUsd: number; spentUsd: number }>();
  return results.map((row) => ({ ...row, ratio: row.budgetUsd > 0 ? row.spentUsd / row.budgetUsd : 0, warning: row.budgetUsd > 0 && row.spentUsd >= 0.8 * row.budgetUsd }));
}

export async function usageCalls(env: Env, tenantId: string, filter: UsageFilter, limit = 200) {
  const where = callWhere(tenantId, filter);
  const { results } = await env.DB.prepare(
    `SELECT c.id, c.ts, c.run_id AS runId, c.agent_id AS agentId, COALESCE((SELECT name FROM agents a WHERE a.id = c.agent_id), c.agent_id) AS agent,
            c.project_id AS projectId, c.thread_id AS threadId, c.task_id AS taskId, c.step, c.alias, c.provider, c.model, c.status,
            c.tokens_in AS tokensIn, c.tokens_out AS tokensOut, c.cache_read_tokens AS cacheReadTokens, c.cache_write_tokens AS cacheWriteTokens,
            c.input_usd_per_m AS inputUsdPerM, c.output_usd_per_m AS outputUsdPerM, c.price_source AS priceSource, c.cost_usd AS costUsd,
            c.latency_ms AS latencyMs, c.first_token_ms AS firstTokenMs, c.key_source AS keySource, c.strict_policy AS strictPolicy, c.error
       FROM model_calls c WHERE ${where.sql} ORDER BY c.ts DESC LIMIT ?`,
  )
    .bind(...where.params, Math.min(Math.max(limit, 1), MAX_EXPORT_ROWS))
    .all();
  return results;
}

const RUN_COLUMNS = `r.id, r.agent_id AS agentId, COALESCE((SELECT name FROM agents a WHERE a.id = r.agent_id), r.agent_id) AS agent, r.project_id AS projectId,
  r.thread_id AS threadId, r.task_id AS taskId, r.kind, r.status, r.started_at AS startedAt, r.ended_at AS endedAt, r.steps, r.model_calls AS modelCalls,
  r.tool_calls AS toolCalls, r.tokens_in AS tokensIn, r.tokens_out AS tokensOut, r.cost_usd AS costUsd, r.outcome`;

export async function usageRuns(env: Env, tenantId: string, filter: UsageFilter, limit = 100) {
  const parts = ["r.tenant_id = ?", "r.started_at >= ?", "r.started_at <= ?"];
  const params: unknown[] = [tenantId, filter.from, filter.to];
  if (filter.projectId) (parts.push("r.project_id = ?"), params.push(filter.projectId));
  if (filter.agentId) (parts.push("r.agent_id = ?"), params.push(filter.agentId));
  if (filter.status) (parts.push("r.status = ?"), params.push(filter.status));
  const { results } = await env.DB.prepare(
    `SELECT ${RUN_COLUMNS} FROM runs r WHERE ${parts.join(" AND ")} ORDER BY r.started_at DESC LIMIT ?`,
  )
    .bind(...params, Math.min(Math.max(limit, 1), MAX_ROWS))
    .all();
  return results;
}

/** One run with every model and tool call in order: the trace. */
export async function runTrace(env: Env, tenantId: string, runId: string) {
  const run = await env.DB.prepare(`SELECT ${RUN_COLUMNS} FROM runs r WHERE r.tenant_id = ? AND r.id = ?`).bind(tenantId, runId).first();
  if (!run) return null;
  const [calls, tools] = await Promise.all([
    env.DB.prepare(
      `SELECT id, ts, step, alias, provider, model, status, tokens_in AS tokensIn, tokens_out AS tokensOut, cache_read_tokens AS cacheReadTokens,
              cache_write_tokens AS cacheWriteTokens, cost_usd AS costUsd, price_source AS priceSource, latency_ms AS latencyMs, first_token_ms AS firstTokenMs,
              key_source AS keySource, strict_policy AS strictPolicy, attempts, error
         FROM model_calls WHERE tenant_id = ? AND run_id = ? ORDER BY ts, id`,
    )
      .bind(tenantId, runId)
      .all<Record<string, unknown>>(),
    env.DB.prepare(
      `SELECT id, ts, step, tool, args_preview AS argsPreview, ok, approval_id AS approvalId, duration_ms AS durationMs, result_preview AS resultPreview
         FROM tool_calls WHERE tenant_id = ? AND run_id = ? ORDER BY ts, id`,
    )
      .bind(tenantId, runId)
      .all(),
  ]);
  return {
    run,
    modelCalls: calls.results.map((row) => ({ ...row, attempts: typeof row.attempts === "string" ? (JSON.parse(row.attempts) as string[]) : [] })),
    toolCalls: tools.results,
  };
}

const CSV_COLUMNS = [
  "ts", "agent", "projectId", "runId", "step", "provider", "model", "status", "tokensIn", "tokensOut", "cacheReadTokens", "cacheWriteTokens",
  "inputUsdPerM", "outputUsdPerM", "priceSource", "costUsd", "latencyMs", "firstTokenMs", "keySource", "strictPolicy", "error",
] as const;

export function toCsv(rows: Record<string, unknown>[]): string {
  const cell = (value: unknown): string => {
    if (value === null || value === undefined) return "";
    const text = typeof value === "number" ? String(value) : String(value);
    // Leading =, +, - or @ would turn into a formula in spreadsheet programs.
    const safe = /^[=+\-@]/.test(text) && typeof value !== "number" ? `'${text}` : text;
    return /[",\n\r;]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
  };
  const lines = rows.map((row) => CSV_COLUMNS.map((column) => cell(column === "ts" ? new Date(Number(row.ts)).toISOString() : row[column])).join(","));
  return [CSV_COLUMNS.join(","), ...lines].join("\n");
}

export async function handleUsage(request: Request, env: Env, caller: Caller, path: string): Promise<Response | null> {
  if (request.method !== "GET" || !path.startsWith("/api/usage")) return null;
  const params = new URL(request.url).searchParams;
  const filter = parseFilter(params);
  if (path === "/api/usage/summary") return json(await usageSummary(env, caller.tenantId, filter));
  if (path === "/api/usage/calls") return json(await usageCalls(env, caller.tenantId, filter, Math.min(Number(params.get("limit") ?? 200) || 200, MAX_ROWS)));
  if (path === "/api/usage/runs") return json(await usageRuns(env, caller.tenantId, filter, Number(params.get("limit") ?? 100) || 100));
  if (path === "/api/usage/export.csv") {
    const rows = (await usageCalls(env, caller.tenantId, filter, MAX_EXPORT_ROWS)) as Record<string, unknown>[];
    return new Response(toCsv(rows), {
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename="verbrauch-${new Date(filter.from).toISOString().slice(0, 10)}-${new Date(filter.to).toISOString().slice(0, 10)}.csv"`,
        "cache-control": "no-store",
      },
    });
  }
  const runMatch = path.match(/^\/api\/usage\/runs\/([0-9a-f-]{36})$/);
  if (runMatch) {
    const trace = await runTrace(env, caller.tenantId, runMatch[1] ?? "");
    return trace ? json(trace) : json({ error: "Lauf nicht gefunden." }, 404);
  }
  return json({ error: "Nicht gefunden" }, 404);
}
