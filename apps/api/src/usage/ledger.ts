import type { Env } from "../env.ts";

/**
 * The usage ledger (plan stage 1): runs, model calls and tool calls as rows. Writes never break a run: a failed
 * insert is logged and the agent carries on, because the ledger observes the run and must not steer it.
 */
export type RunKind = "chat" | "task" | "review";
export type RunStatus = "running" | "done" | "failed" | "stopped" | "step_limit";

export interface RunStart {
  id: string;
  tenantId: string;
  agentId: string;
  projectId?: string;
  threadId?: string;
  taskId?: string;
  kind: RunKind;
  startedAt: number;
}

export interface ModelCallRecord {
  tenantId: string;
  runId?: string;
  agentId?: string;
  projectId?: string;
  threadId?: string;
  taskId?: string;
  step?: number;
  alias?: string;
  provider: string;
  model: string;
  status: "ok" | "error";
  tokensIn?: number;
  tokensOut?: number;
  cacheReadTokens?: number;
  cacheWriteTokens?: number;
  inputUsdPerM?: number;
  outputUsdPerM?: number;
  priceSource?: string;
  costUsd?: number;
  latencyMs?: number;
  firstTokenMs?: number | null;
  keySource?: string | null;
  strictPolicy?: boolean;
  attempts?: string[];
  error?: string | null;
}

export interface ToolCallRecord {
  tenantId: string;
  runId?: string;
  agentId?: string;
  projectId?: string;
  step?: number;
  tool: string;
  argsPreview?: string;
  ok: boolean;
  approvalId?: string | null;
  durationMs?: number | null;
  resultPreview?: string | null;
}

async function safely(what: string, work: () => Promise<unknown>): Promise<void> {
  try {
    await work();
  } catch (error) {
    console.error(`usage ledger: ${what} failed`, error instanceof Error ? error.message : error);
  }
}

export function startRun(env: Env, run: RunStart): Promise<void> {
  return safely("start run", () =>
    env.DB.prepare("INSERT OR IGNORE INTO runs (id, tenant_id, agent_id, project_id, thread_id, task_id, kind, started_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
      .bind(run.id, run.tenantId, run.agentId, run.projectId || null, run.threadId ?? null, run.taskId ?? null, run.kind, run.startedAt)
      .run(),
  );
}

export function finishRun(env: Env, tenantId: string, runId: string, status: Exclude<RunStatus, "running">, fields: { steps?: number; stages?: number; outcome?: string }): Promise<void> {
  return safely("finish run", () =>
    env.DB.prepare(
      "UPDATE runs SET status = ?, ended_at = ?, steps = COALESCE(?, steps), stages = COALESCE(?, stages), outcome = ? WHERE tenant_id = ? AND id = ? AND status = 'running'",
    )
      .bind(status, Date.now(), fields.steps ?? null, fields.stages ?? null, fields.outcome?.slice(0, 500) ?? null, tenantId, runId)
      .run(),
  );
}

export function recordModelCall(env: Env, call: ModelCallRecord): Promise<void> {
  return safely("model call", async () => {
    const statements = [
      env.DB.prepare(
        `INSERT INTO model_calls (tenant_id, run_id, agent_id, project_id, thread_id, task_id, step, alias, provider, model, status, tokens_in, tokens_out,
           cache_read_tokens, cache_write_tokens, input_usd_per_m, output_usd_per_m, price_source, cost_usd, latency_ms, first_token_ms, key_source, strict_policy, attempts, error, ts)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).bind(
        call.tenantId, call.runId ?? null, call.agentId ?? null, call.projectId || null, call.threadId ?? null, call.taskId ?? null, call.step ?? null,
        call.alias ?? null, call.provider, call.model, call.status, call.tokensIn ?? 0, call.tokensOut ?? 0, call.cacheReadTokens ?? 0, call.cacheWriteTokens ?? 0,
        call.inputUsdPerM ?? 0, call.outputUsdPerM ?? 0, call.priceSource ?? "catalog", call.costUsd ?? 0, call.latencyMs ?? null, call.firstTokenMs ?? null,
        call.keySource ?? null, call.strictPolicy ? 1 : 0, call.attempts ? JSON.stringify(call.attempts) : null, call.error?.slice(0, 1_000) ?? null, Date.now(),
      ),
    ];
    if (call.runId) {
      statements.push(
        env.DB.prepare(
          "UPDATE runs SET model_calls = model_calls + 1, tokens_in = tokens_in + ?, tokens_out = tokens_out + ?, cost_usd = cost_usd + ?, steps = MAX(steps, COALESCE(?, steps)) WHERE tenant_id = ? AND id = ?",
        ).bind(call.tokensIn ?? 0, call.tokensOut ?? 0, call.costUsd ?? 0, call.step ?? null, call.tenantId, call.runId),
      );
    }
    await env.DB.batch(statements);
  });
}

export function recordToolCall(env: Env, call: ToolCallRecord): Promise<void> {
  return safely("tool call", async () => {
    const statements = [
      env.DB.prepare(
        "INSERT INTO tool_calls (tenant_id, run_id, agent_id, project_id, step, tool, args_preview, ok, approval_id, duration_ms, result_preview, ts) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      ).bind(
        call.tenantId, call.runId ?? null, call.agentId ?? null, call.projectId || null, call.step ?? null, call.tool, call.argsPreview?.slice(0, 600) ?? null,
        call.ok ? 1 : 0, call.approvalId ?? null, call.durationMs ?? null, call.resultPreview?.slice(0, 600) ?? null, Date.now(),
      ),
    ];
    if (call.runId) statements.push(env.DB.prepare("UPDATE runs SET tool_calls = tool_calls + 1 WHERE tenant_id = ? AND id = ?").bind(call.tenantId, call.runId));
    await env.DB.batch(statements);
  });
}

/** Today's (UTC) spend of an agent from the ledger: the daily budget counts real model calls. */
export async function spentTodayFromLedger(env: Env, tenantId: string, agentId: string): Promise<number> {
  const startOfDay = new Date();
  startOfDay.setUTCHours(0, 0, 0, 0);
  const row = await env.DB.prepare("SELECT COALESCE(SUM(cost_usd), 0) AS spent FROM model_calls WHERE tenant_id = ? AND agent_id = ? AND ts >= ?")
    .bind(tenantId, agentId, startOfDay.getTime())
    .first<{ spent: number }>();
  return row?.spent ?? 0;
}
