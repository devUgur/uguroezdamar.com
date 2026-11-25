import { AGENTS } from "./agents/registry.ts";
import { authorize } from "./auth.ts";
import type { Env } from "./env.ts";
import { emit, recentEvents } from "./events.ts";
import { DEFAULT_MODEL_CONFIG } from "./models/config.ts";
import { SubrequestBudget } from "./runtime/budget.ts";
import { toolByName } from "./tools/registry.ts";

export { AgentRuntime } from "./agent.ts";
export { LiveHub } from "./hub.ts";

const DEFAULT_PROJECT = "uguroezdamar";

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });
}

async function body<T>(request: Request): Promise<Partial<T>> {
  try {
    return (await request.json()) as Partial<T>;
  } catch {
    return {};
  }
}

function agentStub(env: Env, agentId: string) {
  return env.AGENTS.get(env.AGENTS.idFromName(agentId));
}

interface ApprovalRow {
  id: string;
  agent_id: string;
  action: string;
  details: string;
  status: string;
  expires_at: number | null;
  created_at: number;
}

async function decideApproval(env: Env, id: string, approve: boolean): Promise<Response> {
  const row = await env.DB.prepare("SELECT * FROM approvals WHERE id = ?").bind(id).first<ApprovalRow>();
  if (!row) return json({ error: "Freigabe nicht gefunden" }, 404);
  if (row.status !== "pending") return json({ error: `Bereits entschieden: ${row.status}` }, 409);
  if (row.expires_at && row.expires_at * 1000 < Date.now()) {
    await env.DB.prepare("UPDATE approvals SET status = 'expired' WHERE id = ? AND status = 'pending'").bind(id).run();
    return json({ error: "Freigabe abgelaufen; der Agent muss sie neu vorschlagen." }, 410);
  }

  // Claim it first so a double click cannot run the action twice.
  const claimed = await env.DB.prepare("UPDATE approvals SET status = ?, decided_at = unixepoch() WHERE id = ? AND status = 'pending'")
    .bind(approve ? "approved" : "rejected", id)
    .run();
  if (!claimed.meta.changes) return json({ error: "Bereits entschieden" }, 409);

  const details = JSON.parse(row.details) as { args: Record<string, unknown>; projectId: string; repo: string };
  let outcome = "Abgelehnt von Ugur.";
  let ok = false;
  if (approve) {
    const tool = toolByName(row.action);
    try {
      if (!tool) throw new Error(`Werkzeug ${row.action} existiert nicht mehr.`);
      const budget = new SubrequestBudget();
      const result = await tool.run(details.args, { env, agentId: row.agent_id, projectId: details.projectId, repo: details.repo, budget });
      outcome = JSON.stringify(result);
      ok = true;
    } catch (error) {
      outcome = `Fehler: ${error instanceof Error ? error.message : String(error)}`;
      await env.DB.prepare("UPDATE approvals SET status = 'failed' WHERE id = ?").bind(id).run();
    }
  }

  await emit(env, {
    agentId: row.agent_id,
    projectId: details.projectId,
    type: "approval_decided",
    data: { approvalId: id, tool: row.action, approved: approve, ok, outcome: outcome.slice(0, 600) },
  });

  await agentStub(env, row.agent_id).resume({
    agentId: row.agent_id,
    projectId: details.projectId,
    approvalId: id,
    tool: row.action,
    approved: approve,
    outcome: outcome.slice(0, 4000),
  });
  return json({ approved: approve, ok, outcome });
}

async function handleApi(request: Request, env: Env, url: URL): Promise<Response> {
  const path = url.pathname.replace(/\/+$/, "");
  const method = request.method;

  if (path === "/api/health") return json({ ok: true, env: env.PLATFORM_ENV || "production" });
  // The hub checks the one-time ticket itself; browsers cannot send headers on a WebSocket.
  if (path === "/api/live") return env.HUB.get(env.HUB.idFromName("main")).fetch(request);
  if (!(await authorize(request, env))) return json({ error: "Nicht angemeldet" }, 401);

  if (path === "/api/live-ticket" && method === "POST") {
    return json({ ticket: await env.HUB.get(env.HUB.idFromName("main")).issueTicket() });
  }

  if (path === "/api/agents" && method === "GET") {
    const { results } = await env.DB.prepare(
      `SELECT a.id, a.name, a.role, a.model_alias, a.daily_budget_usd, a.desk_x, a.desk_y,
              (SELECT type FROM events e WHERE e.agent_id = a.id ORDER BY e.id DESC LIMIT 1) AS last_event
         FROM agents a WHERE a.active = 1 ORDER BY a.created_at`,
    ).all();
    return json(results.map((row) => ({ ...row, configured: Boolean(AGENTS[String(row.id)]) })));
  }

  const agentMatch = path.match(/^\/api\/agents\/([a-z0-9-]+)\/(chat|history|reset|stop|status)$/);
  if (agentMatch) {
    const agentId = agentMatch[1] ?? "";
    const action = agentMatch[2];
    if (!AGENTS[agentId]) return json({ error: "Unbekannter Agent" }, 404);
    const stub = agentStub(env, agentId);
    if (action === "history" && method === "GET") return json(await stub.history());
    if (action === "status" && method === "GET") return json(await stub.status());
    if (action === "stop" && method === "POST") {
      await stub.stop();
      return json({ ok: true });
    }
    if (action === "reset" && method === "POST") {
      await stub.reset();
      return json({ ok: true });
    }
    if (action === "chat" && method === "POST") {
      const input = await body<{ text: string; projectId: string }>(request);
      const text = input.text?.trim();
      if (!text) return json({ error: "Leere Nachricht" }, 400);
      return json(await stub.chat({ agentId, projectId: input.projectId ?? DEFAULT_PROJECT, text: text.slice(0, 20_000) }));
    }
  }

  if (path === "/api/events" && method === "GET") {
    return json(
      await recentEvents(env, {
        sinceId: Number(url.searchParams.get("since") ?? 0) || undefined,
        agentId: url.searchParams.get("agent") ?? undefined,
        limit: Number(url.searchParams.get("limit") ?? 150),
      }),
    );
  }

  if (path === "/api/approvals" && method === "GET") {
    const status = url.searchParams.get("status") ?? "pending";
    const { results } = await env.DB.prepare(
      `SELECT id, agent_id, action, status, summary, risk, warnings, expires_at, created_at FROM approvals
        WHERE status = ? AND (? <> 'pending' OR expires_at IS NULL OR expires_at > unixepoch())
        ORDER BY created_at DESC LIMIT 50`,
    )
      .bind(status, status)
      .all<Record<string, unknown>>();
    return json(results.map((row) => ({ ...row, warnings: row.warnings ? (JSON.parse(String(row.warnings)) as string[]) : [] })));
  }

  const approvalMatch = path.match(/^\/api\/approvals\/([0-9a-f-]{36})$/);
  if (approvalMatch && method === "POST") {
    const { decision } = await body<{ decision: "approve" | "reject" }>(request);
    if (decision !== "approve" && decision !== "reject") return json({ error: "decision: approve | reject" }, 400);
    return decideApproval(env, approvalMatch[1] ?? "", decision === "approve");
  }

  if (path === "/api/projects" && method === "GET") {
    const { results } = await env.DB.prepare("SELECT * FROM projects ORDER BY name").all();
    return json(results);
  }

  if (path === "/api/models" && method === "GET") {
    const override = await env.CONFIG.get("models", "json").catch(() => null);
    return json({ defaults: DEFAULT_MODEL_CONFIG.aliases, override, viaGateway: env.MODEL_VIA_GATEWAY === "true" });
  }

  return json({ error: "Nicht gefunden" }, 404);
}

export default {
  async fetch(request, env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname.startsWith("/api/")) {
      try {
        return await handleApi(request, env, url);
      } catch (error) {
        console.error("api error", error);
        return json({ error: error instanceof Error ? error.message : "Interner Fehler" }, 500);
      }
    }
    return env.ASSETS.fetch(request);
  },
} satisfies ExportedHandler<Env>;
