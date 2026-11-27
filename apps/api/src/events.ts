import type { Env } from "./env.ts";
import { hubObjectName, officeObjectName } from "./tenancy.ts";

/** Everything an agent does becomes an event: the portal chat, the office view and cost reports read these. */
export type EventType =
  | "user_message"
  | "thinking"
  | "model_result"
  | "tool_call"
  | "tool_result"
  | "approval_requested"
  | "approval_decided"
  | "message"
  | "error"
  | "budget_blocked"
  | "stage_paused"
  | "stopped"
  | "task_created"
  | "task_updated"
  | "task_review_started"
  | "task_review_completed"
  | "organization_updated"
  | "sprint_created"
  | "sprint_updated"
  | "github_issue_synced"
  | "agent_handoff"
  | "project_policy_changed"
  | "policy_allowed"
  | "knowledge_indexed"

  | "sandbox_run"
  | "preview_deployed";

export interface AgentEvent {
  /** The tenant the event belongs to. Required: an event without it would silently land with the owner. */
  tenantId: string;
  agentId?: string;
  threadId?: string;
  taskId?: string;
  projectId?: string;
  type: EventType;
  data?: unknown;
  tokensIn?: number;
  tokensOut?: number;
  costUsd?: number;
}

export interface StoredEvent extends AgentEvent {
  id: number;
  ts: number;
}

interface EventRow {
  id: number;
  ts: number;
  agent_id: string | null;
  thread_id: string | null;
  task_id: string | null;
  project_id: string | null;
  type: EventType;
  data: string | null;
  tokens_in: number;
  tokens_out: number;
  cost_usd: number;
}

/** Writes the event to D1, then pushes it to every open portal chat. */
export async function emit(env: Env, event: AgentEvent): Promise<StoredEvent> {
  const row = await env.DB.prepare(
    `INSERT INTO events (tenant_id, agent_id, thread_id, task_id, project_id, type, data, tokens_in, tokens_out, cost_usd)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id, ts`,
  )
    .bind(
      event.tenantId,
      event.agentId ?? null,
      event.threadId ?? null,
      event.taskId ?? null,
      event.projectId || null,
      event.type,
      event.data === undefined ? null : JSON.stringify(event.data),
      event.tokensIn ?? 0,
      event.tokensOut ?? 0,
      event.costUsd ?? 0,
    )
    .first<{ id: number; ts: number }>();

  const stored: StoredEvent = { ...event, id: row?.id ?? 0, ts: row?.ts ?? Date.now() };
  if (stored.agentId && stored.id) {
    try {
      await env.OFFICE.get(officeObjectName(event.tenantId)).recordEvent({
        agentId: stored.agentId,
        type: stored.type,
        id: stored.id,
      });
    } catch (error) {
      console.error("office state update failed", error);
    }
  }
  try {
    await env.HUB.get(hubObjectName(event.tenantId)).broadcast(JSON.stringify({ type: "event", event: stored }));
  } catch (error) {
    console.error("live hub broadcast failed", error);
  }
  return stored;
}

export async function recentEvents(
  env: Env,
  options: { tenantId: string; sinceId?: number; agentId?: string; threadId?: string; limit?: number },
): Promise<StoredEvent[]> {
  const limit = Math.min(Math.max(options.limit ?? 100, 1), 500);
  const conditions: string[] = [];
  const params: (string | number)[] = [options.tenantId];
  if (options.sinceId) {
    conditions.push("id > ?");
    params.push(options.sinceId);
  }
  if (options.agentId) {
    conditions.push("agent_id = ?");
    params.push(options.agentId);
  }
  if (options.threadId) {
    conditions.push("thread_id = ?");
    params.push(options.threadId);
  }
  const more = conditions.map((condition) => ` AND ${condition}`).join("");
  const { results } = await env.DB.prepare(`SELECT * FROM events WHERE tenant_id = ?${more} ORDER BY id DESC LIMIT ?`)
    .bind(...params, limit)
    .all<EventRow>();
  return results.reverse().map((row) => ({
    tenantId: options.tenantId,
    id: row.id,
    ts: row.ts,
    agentId: row.agent_id ?? undefined,
    threadId: row.thread_id ?? undefined,
    taskId: row.task_id ?? undefined,
    projectId: row.project_id ?? undefined,
    type: row.type,
    data: row.data ? (JSON.parse(row.data) as unknown) : undefined,
    tokensIn: row.tokens_in,
    tokensOut: row.tokens_out,
    costUsd: row.cost_usd,
  }));
}

/** Spend of one agent for one tenant since 00:00 UTC, for the budget guard. */
export async function spentToday(env: Env, tenantId: string, agentId: string): Promise<number> {
  const startOfDay = new Date();
  startOfDay.setUTCHours(0, 0, 0, 0);
  const row = await env.DB.prepare("SELECT COALESCE(SUM(cost_usd), 0) AS spent FROM events WHERE tenant_id = ? AND agent_id = ? AND ts >= ?")
    .bind(tenantId, agentId, startOfDay.getTime())
    .first<{ spent: number }>();
  return row?.spent ?? 0;
}
