import { describeAgent } from "./agents/describe.ts";
import { AGENTS } from "./agents/registry.ts";
import { authorize, type Caller } from "./auth.ts";
import type { Env } from "./env.ts";
import { emit, recentEvents } from "./events.ts";
import { ModelRouter } from "./models/router.ts";
import { handleModels } from "./models/routes.ts";
import { GithubAccessError } from "./github/app.ts";
import { completeConnect, startConnect } from "./github/connect.ts";
import { githubStatus } from "./github/credentials.ts";
import { handleGithubWebhook } from "./github/webhook.ts";
import { listRepositories, ProjectError, registerProject, unregisterProject } from "./projects/repositories.ts";
import { buildOfficeLayout } from "./office/layout.ts";
import { officeActivityOf } from "./office/presence.ts";
import { organizationCatalog } from "./organization/catalog.ts";
import { handleOrganizationManagement } from "./organization/manage.ts";
import { SubrequestBudget } from "./runtime/budget.ts";
import { officeObjectName, threadObjectName } from "./tenancy.ts";
import { toolByName } from "./tools/registry.ts";
import { listPreviews } from "./workstation/previews.ts";
import { handleSprints } from "./work/sprints.ts";
import { handleTasks } from "./work/tasks.ts";

export { AgentRuntime } from "./agent.ts";
export { LiveHub } from "./hub.ts";
export { OfficePresence } from "./office/presence.ts";
// Containers of the agents (ADR 0035). Exported so activation is configuration only; unused until wrangler.jsonc binds them.
export { Workstation } from "./workstation/workstation.ts";
export { GitGateway, PreviewGateway, RegistryGateway } from "./workstation/gateways.ts";

const DEFAULT_PROJECT = "uguroezdamar";
const DEFAULT_AGENT = "chef";
const ID = "[0-9a-f-]{36}";

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });
}

function projectFailure(error: unknown): Response {
  if (error instanceof ProjectError) return json({ error: error.message }, error.status);
  throw error;
}

async function body<T>(request: Request): Promise<Partial<T>> {
  try {
    return (await request.json()) as Partial<T>;
  } catch {
    return {};
  }
}

function threadStub(env: Env, tenantId: string, threadId: string) {
  return env.AGENTS.get(env.AGENTS.idFromName(threadObjectName(tenantId, threadId)));
}

interface ThreadRow {
  id: string;
  agent_id: string;
  project_id: string | null;
  task_id: string | null;
  title: string | null;
  model: string | null;
  created_by: string | null;
  created_at: number;
  updated_at: number;
  last_event?: string | null;
}

function toThread(row: ThreadRow) {
  return {
    id: row.id,
    agentId: row.agent_id,
    projectId: row.project_id ?? DEFAULT_PROJECT,
    taskId: row.task_id,
    title: row.title,
    model: row.model ? (JSON.parse(row.model) as { provider: string; model: string }) : null,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lastEvent: row.last_event ?? null,
  };
}

async function loadThread(env: Env, tenantId: string, id: string): Promise<ThreadRow | null> {
  return env.DB.prepare("SELECT * FROM threads WHERE tenant_id = ? AND id = ? AND archived = 0").bind(tenantId, id).first<ThreadRow>();
}

async function officeSnapshot(env: Env, tenantId: string) {
  const { results } = await env.DB.prepare(
    `SELECT a.id, a.desk_x, a.desk_y,
            (SELECT e.type FROM events e WHERE e.tenant_id = ?1 AND e.agent_id = a.id ORDER BY e.id DESC LIMIT 1) AS last_event,
            (SELECT e.id FROM events e WHERE e.tenant_id = ?1 AND e.agent_id = a.id ORDER BY e.id DESC LIMIT 1) AS last_event_id
       FROM agents a WHERE a.active = 1 ORDER BY a.created_at`,
  )
    .bind(tenantId)
    .all<{ id: string; desk_x: number | null; desk_y: number | null; last_event: string | null; last_event_id: number | null }>();
  const active = results.filter((row) => AGENTS[row.id]);
  const layout = buildOfficeLayout(active.map((row) => ({ id: row.id, deskX: Number(row.desk_x ?? 0), deskY: Number(row.desk_y ?? 0) })));
  const byId = new Map(active.map((row) => [row.id, row]));
  const snapshot = await env.OFFICE.get(env.OFFICE.idFromName(officeObjectName(tenantId))).configure({
    bounds: layout.bounds,
    agents: layout.agents.map((placement) => {
      const row = byId.get(placement.agentId);
      return {
        ...placement,
        activity: officeActivityOf(row?.last_event),
        lastEventId: Number(row?.last_event_id ?? 0),
      };
    }),
  });
  return snapshot;
}

interface ApprovalRow {
  id: string;
  agent_id: string;
  thread_id: string | null;
  task_id: string | null;
  action: string;
  details: string;
  status: string;
  expires_at: number | null;
  created_at: number;
}

async function pendingApprovals(env: Env, tenantId: string, threadId?: string) {
  const { results } = await env.DB.prepare(
    `SELECT id, agent_id, thread_id, action, summary, risk, warnings, expires_at, created_at FROM approvals
      WHERE tenant_id = ? AND status = 'pending' AND (expires_at IS NULL OR expires_at > unixepoch()) AND (? IS NULL OR thread_id = ?)
      ORDER BY created_at DESC LIMIT 50`,
  )
    .bind(tenantId, threadId ?? null, threadId ?? null)
    .all<Record<string, unknown>>();
  return results.map((row) => ({
    id: String(row.id),
    agentId: String(row.agent_id),
    threadId: row.thread_id ? String(row.thread_id) : null,
    action: String(row.action),
    summary: row.summary ? String(row.summary) : null,
    risk: row.risk ? String(row.risk) : null,
    warnings: row.warnings ? (JSON.parse(String(row.warnings)) as string[]) : [],
    expiresAt: row.expires_at === null ? null : Number(row.expires_at),
  }));
}

async function decideApproval(env: Env, caller: Caller, id: string, approve: boolean): Promise<Response> {
  const row = await env.DB.prepare("SELECT * FROM approvals WHERE tenant_id = ? AND id = ?").bind(caller.tenantId, id).first<ApprovalRow>();
  if (!row) return json({ error: "Freigabe nicht gefunden" }, 404);
  if (row.status !== "pending") return json({ error: `Bereits entschieden: ${row.status}` }, 409);
  if (row.expires_at && row.expires_at * 1000 < Date.now()) {
    await env.DB.prepare("/* tenant:parent */ UPDATE approvals SET status = 'expired' WHERE id = ? AND status = 'pending'").bind(id).run();
    return json({ error: "Freigabe abgelaufen; der Agent muss sie neu vorschlagen." }, 410);
  }

  // Claim it first so a double click cannot run the action twice.
  const claimed = await env.DB.prepare("/* tenant:parent */ UPDATE approvals SET status = ?, decided_at = unixepoch() WHERE id = ? AND status = 'pending'")
    .bind(approve ? "approved" : "rejected", id)
    .run();
  if (!claimed.meta.changes) return json({ error: "Bereits entschieden" }, 409);

  const details = JSON.parse(row.details) as { args: Record<string, unknown>; projectId: string; repo: string };
  let outcome = `Abgelehnt von ${caller.actor}.`;
  let ok = false;
  if (approve) {
    const tool = toolByName(row.action);
    try {
      if (!tool) throw new Error(`Werkzeug ${row.action} existiert nicht mehr.`);
      const budget = new SubrequestBudget();
      const result = await tool.run(details.args, { env, tenantId: caller.tenantId, agentId: row.agent_id, threadId: row.thread_id ?? undefined, projectId: details.projectId, repo: details.repo, budget });
      outcome = JSON.stringify(result);
      ok = true;
    } catch (error) {
      outcome = `Fehler: ${error instanceof Error ? error.message : String(error)}`;
      await env.DB.prepare("/* tenant:parent */ UPDATE approvals SET status = 'failed' WHERE id = ?").bind(id).run();
    }
  }

  await emit(env, {
    tenantId: caller.tenantId,
    agentId: row.agent_id,
    threadId: row.thread_id ?? undefined,
    taskId: row.task_id ?? undefined,
    projectId: details.projectId,
    type: "approval_decided",
    data: { approvalId: id, tool: row.action, approved: approve, ok, by: caller.actor, outcome: outcome.slice(0, 600) },
  });

  if (row.thread_id) {
    await threadStub(env, caller.tenantId, row.thread_id).resume({
      tenantId: caller.tenantId,
      threadId: row.thread_id,
      agentId: row.agent_id,
      projectId: details.projectId,
      taskId: row.task_id ?? undefined,
      approvalId: id,
      tool: row.action,
      approved: approve,
      outcome: outcome.slice(0, 4000),
    });
  }
  return json({ approved: approve, ok, outcome });
}

async function handleThreads(request: Request, env: Env, caller: Caller, path: string): Promise<Response | null> {
  const method = request.method;

  if (path === "/api/threads" && method === "GET") {
    const { results } = await env.DB.prepare(
      `SELECT t.*, (SELECT type FROM events e WHERE e.thread_id = t.id ORDER BY e.id DESC LIMIT 1) AS last_event
         FROM threads t WHERE t.tenant_id = ? AND t.archived = 0 ORDER BY t.updated_at DESC LIMIT 100`,
    )
      .bind(caller.tenantId)
      .all<ThreadRow>();
    return json(results.map(toThread));
  }

  if (path === "/api/threads" && method === "POST") {
    const input = await body<{ agentId: string; projectId: string; title: string; model: { provider: string; model: string } | null }>(request);
    const agentId = input.agentId && AGENTS[input.agentId] ? input.agentId : DEFAULT_AGENT;
    const activeAgent = await env.DB.prepare("SELECT 1 FROM agents WHERE id = ? AND active = 1").bind(agentId).first();
    if (!activeAgent) return json({ error: "Der ausgewählte Agent ist nicht aktiv." }, 409);
    if (input.projectId) {
      const project = await env.DB.prepare("SELECT 1 FROM projects WHERE tenant_id = ? AND id = ? AND status = 'active'").bind(caller.tenantId, input.projectId).first();
      if (!project) return json({ error: "Unbekanntes oder entferntes Projekt" }, 400);
    }
    const id = crypto.randomUUID();
    await env.DB.prepare("INSERT INTO threads (id, tenant_id, agent_id, project_id, title, model, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)")
      .bind(id, caller.tenantId, agentId, input.projectId ?? DEFAULT_PROJECT, input.title?.slice(0, 120) ?? null, input.model ? JSON.stringify(input.model) : null, caller.actor)
      .run();
    const row = await loadThread(env, caller.tenantId, id);
    return json(row ? toThread(row) : { id }, 201);
  }

  const match = path.match(new RegExp(`^/api/threads/(${ID})(?:/(chat|stop))?$`));
  if (!match) return null;
  const threadId = match[1] ?? "";
  const action = match[2];
  const thread = await loadThread(env, caller.tenantId, threadId);
  if (!thread) return json({ error: "Thread nicht gefunden" }, 404);
  const stub = threadStub(env, caller.tenantId, threadId);

  if (!action && method === "GET") {
    const [messages, status, approvals] = await Promise.all([stub.history(), stub.status(), pendingApprovals(env, caller.tenantId, threadId)]);
    const events = await recentEvents(env, { tenantId: caller.tenantId, threadId, limit: 200 });
    const { results: projects } = await env.DB.prepare("SELECT id, name, repo, visibility FROM projects WHERE tenant_id = ? AND status = 'active' ORDER BY name")
      .bind(caller.tenantId)
      .all();
    return json({ thread: toThread(thread), messages, status, approvals, events, projects });
  }

  if (!action && method === "PATCH") {
    const input = await body<{ title: string; projectId: string; model: { provider: string; model: string } | null }>(request);
    if (input.projectId !== undefined) {
      const project = await env.DB.prepare("SELECT 1 FROM projects WHERE tenant_id = ? AND id = ? AND status = 'active'").bind(caller.tenantId, input.projectId).first();
      if (!project) return json({ error: "Unbekanntes oder entferntes Projekt" }, 400);
      if ((await stub.status()).running) return json({ error: "Das Projekt lässt sich nicht wechseln, solange der Agent arbeitet." }, 409);
    }
    if (input.model) {
      const router = await ModelRouter.load(env, caller.tenantId);
      if (!router.offers(input.model)) return json({ error: "Unbekanntes Modell" }, 400);
      await router.warmUp(input.model);
    }
    await env.DB.prepare(
      `/* tenant:parent */ UPDATE threads SET title = COALESCE(?, title), project_id = COALESCE(?, project_id), model = CASE WHEN ? THEN ? ELSE model END, updated_at = unixepoch() WHERE id = ?`,
    )
      .bind(input.title?.slice(0, 120) ?? null, input.projectId ?? null, input.model !== undefined ? 1 : 0, input.model ? JSON.stringify(input.model) : null, threadId)
      .run();
    return json(toThread((await loadThread(env, caller.tenantId, threadId)) ?? thread));
  }

  if (!action && method === "DELETE") {
    await stub.stop();
    await env.DB.prepare("/* tenant:parent */ UPDATE threads SET archived = 1, updated_at = unixepoch() WHERE id = ?").bind(threadId).run();
    return json({ ok: true });
  }

  if (action === "chat" && method === "POST") {
    const input = await body<{ text: string }>(request);
    const text = input.text?.trim();
    if (!text) return json({ error: "Leere Nachricht" }, 400);
    const activeAgent = await env.DB.prepare("SELECT 1 FROM agents WHERE id = ? AND active = 1").bind(thread.agent_id).first();
    if (!activeAgent) return json({ error: "Der Agent dieser Unterhaltung ist deaktiviert." }, 409);
    // The first message names the thread.
    await env.DB.prepare("/* tenant:parent */ UPDATE threads SET title = COALESCE(title, ?), updated_at = unixepoch() WHERE id = ?")
      .bind(text.replace(/\s+/g, " ").slice(0, 80), threadId)
      .run();
    return json(
      await stub.chat({ tenantId: caller.tenantId, threadId, agentId: thread.agent_id, projectId: thread.project_id ?? DEFAULT_PROJECT, taskId: thread.task_id ?? undefined, text: text.slice(0, 20_000) }),
    );
  }

  if (action === "stop" && method === "POST") {
    await stub.stop();
    return json({ ok: true });
  }

  return null;
}

async function handleApi(request: Request, env: Env, url: URL): Promise<Response> {
  const path = url.pathname.replace(/\/+$/, "");
  const method = request.method;

  if (path === "/api/health") return json({ ok: true, env: env.API_ENV || "production" });
  // The hub checks the one-time ticket itself; browsers cannot send headers on a WebSocket.
  if (path === "/api/live") return env.HUB.get(env.HUB.idFromName("main")).fetch(request);

  // GitHub sends the browser here after the app was installed (the app's Setup URL). No service token: the
  // signed, single-use state names the tenant, and GitHub itself is asked about the installation.
  if (path === "/api/github/setup" && method === "GET") {
    const result = await completeConnect(env, Number(url.searchParams.get("installation_id")), url.searchParams.get("state") ?? "");
    if (!result.returnTo) return json({ error: result.error }, 400);
    const target = new URL(result.returnTo);
    target.searchParams.set(result.error ? "error" : "notice", result.error ?? result.notice ?? "");
    return new Response(null, { status: 302, headers: { location: target.toString(), "cache-control": "no-store" } });
  }

  const caller = await authorize(request, env);
  if (!caller) return json({ error: "Nicht angemeldet" }, 401);

  if (path === "/api/live-ticket" && method === "POST") {
    return json({ ticket: await env.HUB.get(env.HUB.idFromName("main")).issueTicket() });
  }

  if (path === "/api/office/state" && method === "GET") return json(await officeSnapshot(env, caller.tenantId));
  if (path === "/api/organization" || path.startsWith("/api/organization/")) {
    const managed = await handleOrganizationManagement(request, env, caller, path);
    if (managed) return managed;
    if (path === "/api/organization" && method === "GET") return json(await organizationCatalog(env));
  }

  const sprints = await handleSprints(request, env, caller, path);
  if (sprints) return sprints;

  const tasks = await handleTasks(request, env, caller, path);
  if (tasks) return tasks;

  const threads = await handleThreads(request, env, caller, path);
  if (threads) return threads;

  const configMatch = path.match(/^\/api\/agents\/([a-z0-9-]{1,40})\/config$/);
  if (configMatch && method === "GET") {
    const description = await describeAgent(env, caller.tenantId, configMatch[1] ?? "");
    return description ? json(description) : json({ error: "Unbekannter Agent" }, 404);
  }

  if (path === "/api/agents" && method === "GET") {
    // Everything the office view needs per agent: who it is, where it sits, what it did last.
    const { results } = await env.DB.prepare(
      `SELECT a.id, a.name, a.role, a.model_alias, a.daily_budget_usd, a.desk_x, a.desk_y,
              (SELECT type FROM events e WHERE e.tenant_id = ?1 AND e.agent_id = a.id ORDER BY e.id DESC LIMIT 1) AS last_event,
              (SELECT ts FROM events e WHERE e.tenant_id = ?1 AND e.agent_id = a.id ORDER BY e.id DESC LIMIT 1) AS last_event_at,
              (SELECT id FROM threads t WHERE t.tenant_id = ?1 AND t.agent_id = a.id AND t.archived = 0 ORDER BY t.updated_at DESC LIMIT 1) AS last_thread_id
         FROM agents a WHERE a.active = 1 ORDER BY a.created_at`,
    )
      .bind(caller.tenantId)
      .all<Record<string, unknown>>();
    return json(
      results
        .filter((row) => AGENTS[String(row.id)])
        .map((row) => {
          const definition = AGENTS[String(row.id)];
          return {
            id: String(row.id),
            name: definition?.name ?? String(row.name),
            role: String(row.role),
            summary: definition?.summary ?? "",
            modelAlias: definition?.modelAlias ?? String(row.model_alias),
            dailyBudgetUsd: Number(row.daily_budget_usd),
            desk: { x: Number(row.desk_x ?? 0), y: Number(row.desk_y ?? 0) },
            lastEvent: row.last_event ? String(row.last_event) : null,
            lastEventAt: row.last_event_at ? Number(row.last_event_at) : null,
            lastThreadId: row.last_thread_id ? String(row.last_thread_id) : null,
          };
        }),
    );
  }

  const models = await handleModels(request, env, caller, path);
  if (models) return models;


  if (path === "/api/events" && method === "GET") {
    return json(
      await recentEvents(env, {
        tenantId: caller.tenantId,
        sinceId: Number(url.searchParams.get("since") ?? 0) || undefined,
        threadId: url.searchParams.get("thread") ?? undefined,
        limit: Number(url.searchParams.get("limit") ?? 150),
      }),
    );
  }

  if (path === "/api/approvals" && method === "GET") {
    return json(await pendingApprovals(env, caller.tenantId, url.searchParams.get("thread") ?? undefined));
  }

  const approvalMatch = path.match(new RegExp(`^/api/approvals/(${ID})$`));
  if (approvalMatch && method === "POST") {
    const { decision } = await body<{ decision: "approve" | "reject" }>(request);
    if (decision !== "approve" && decision !== "reject") return json({ error: "decision: approve | reject" }, 400);
    return decideApproval(env, caller, approvalMatch[1] ?? "", decision === "approve");
  }

  if (path === "/api/projects" && method === "GET") {
    const { results } = await env.DB.prepare(
      `SELECT id, name, repo, domain, status, visibility, default_branch AS defaultBranch, write_mode AS writeMode
         FROM projects WHERE tenant_id = ? AND status = 'active' ORDER BY name`,
    )
      .bind(caller.tenantId)
      .all();
    return json(results);
  }

  // The link behind the portal's "Connect GitHub" button.
  if (path === "/api/github/connect" && method === "POST") {
    const { returnTo } = await body<{ returnTo: string }>(request);
    try {
      return json({ url: await startConnect(env, caller.tenantId, String(returnTo ?? "")) });
    } catch (error) {
      if (error instanceof GithubAccessError) return json({ error: error.message }, error.status);
      throw error;
    }
  }

  // How the API reaches GitHub: GitHub App installations or the personal token (ADR 0031).
  if (path === "/api/github/status" && method === "GET") {
    try {
      return json(await githubStatus(env, caller.tenantId));
    } catch (error) {
      if (error instanceof GithubAccessError) return json({ error: error.message }, error.status);
      throw error;
    }
  }

  // Repositories GitHub shows to the app and the token, so the owner can pick which ones become projects.
  if (path === "/api/github/repositories" && method === "GET") {
    try {
      return json(await listRepositories(env, caller.tenantId));
    } catch (error) {
      return projectFailure(error);
    }
  }

  if (path === "/api/projects" && method === "POST") {
    const { repo } = await body<{ repo: string }>(request);
    try {
      const result = await registerProject(env, caller.tenantId, String(repo ?? "").trim());
      return json(result, result.created ? 201 : 200);
    } catch (error) {
      return projectFailure(error);
    }
  }

  // Preview URLs of a project's branches and pull requests (ADR 0035).
  const previewMatch = path.match(/^\/api\/projects\/([a-z0-9-]{1,40})\/previews$/);
  if (previewMatch && method === "GET") {
    const project = await env.DB.prepare("SELECT 1 FROM projects WHERE tenant_id = ? AND id = ? AND status = 'active'").bind(caller.tenantId, previewMatch[1] ?? "").first();
    if (!project) return json({ error: "Projekt nicht gefunden" }, 404);
    return json({ available: Boolean(env.WORKSTATION && env.CF_WORKERS_SUBDOMAIN && env.AGENT_CF_PREVIEW_TOKEN), previews: await listPreviews(env, caller.tenantId, previewMatch[1] ?? "") });
  }

  const projectMatch = path.match(/^\/api\/projects\/([a-z0-9-]{1,40})$/);
  if (projectMatch && method === "DELETE") {
    try {
      return (await unregisterProject(env, caller.tenantId, projectMatch[1] ?? "")) ? json({ ok: true }) : json({ error: "Projekt nicht gefunden" }, 404);
    } catch (error) {
      return projectFailure(error);
    }
  }

  return json({ error: "Nicht gefunden" }, 404);
}

export default {
  async fetch(request, env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === "/webhooks/github") return handleGithubWebhook(request, env);
    if (!url.pathname.startsWith("/api/")) return json({ service: "uguroezdamar-api", env: env.API_ENV || "production" });
    try {
      return await handleApi(request, env, url);
    } catch (error) {
      console.error("api error", error);
      return json({ error: error instanceof Error ? error.message : "Interner Fehler" }, 500);
    }
  },
} satisfies ExportedHandler<Env>;
