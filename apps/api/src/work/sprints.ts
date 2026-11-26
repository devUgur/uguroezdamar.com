import type { Caller } from "../auth.ts";
import type { Env } from "../env.ts";
import { emit } from "../events.ts";

/**
 * Sprints of a project. A project is one repository; its tasks are planned into sprints or wait in the backlog.
 * Scrum terms organise the flow, nothing more: no meetings or estimates are enforced.
 */
export const SPRINT_STATUSES = ["planned", "active", "done"] as const;
export type SprintStatus = (typeof SPRINT_STATUSES)[number];
const NEXT: Record<SprintStatus, readonly SprintStatus[]> = { planned: ["active"], active: ["done", "planned"], done: [] };

interface SprintRow {
  id: string;
  project_id: string;
  name: string;
  goal: string | null;
  status: SprintStatus;
  starts_at: number | null;
  ends_at: number | null;
  created_by: string | null;
  created_at: number;
  updated_at: number;
  tasks_total?: number;
  tasks_done?: number;
  points_total?: number | null;
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } });
}

async function body(request: Request): Promise<Record<string, unknown> | null> {
  try {
    const value: unknown = await request.json();
    return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

function asSprint(row: SprintRow) {
  return {
    id: row.id,
    projectId: row.project_id,
    name: row.name,
    goal: row.goal,
    status: row.status,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    tasksTotal: Number(row.tasks_total ?? 0),
    tasksDone: Number(row.tasks_done ?? 0),
    pointsTotal: row.points_total === null || row.points_total === undefined ? null : Number(row.points_total),
  };
}

/** Day as a Unix timestamp; accepts "YYYY-MM-DD" from a date field or a number. Missing is null, invalid is NaN. */
function day(value: unknown): number | null {
  if (value === undefined || value === null || value === "") return null;
  const time = typeof value === "number" ? value * 1000 : Date.parse(String(value));
  return Number.isFinite(time) ? Math.floor(time / 1000) : Number.NaN;
}

export async function listSprints(env: Env, tenantId: string, projectId: string) {
  const { results } = await env.DB.prepare(
    `SELECT s.*,
       (SELECT COUNT(*) FROM tasks t WHERE t.tenant_id = s.tenant_id AND t.sprint_id = s.id) AS tasks_total,
       (SELECT COUNT(*) FROM tasks t WHERE t.tenant_id = s.tenant_id AND t.sprint_id = s.id AND t.status = 'done') AS tasks_done,
       (SELECT SUM(story_points) FROM tasks t WHERE t.tenant_id = s.tenant_id AND t.sprint_id = s.id) AS points_total
     FROM sprints s WHERE s.tenant_id = ? AND s.project_id = ?
     ORDER BY CASE s.status WHEN 'active' THEN 0 WHEN 'planned' THEN 1 ELSE 2 END, COALESCE(s.starts_at, s.created_at) DESC`,
  )
    .bind(tenantId, projectId)
    .all<SprintRow>();
  return results.map(asSprint);
}

/** True when the sprint exists for this tenant and project; tasks may only join a sprint of their own project. */
export async function sprintBelongsTo(env: Env, tenantId: string, sprintId: string, projectId: string | null): Promise<boolean> {
  const row = await env.DB.prepare("SELECT project_id FROM sprints WHERE tenant_id = ? AND id = ? AND status != 'done'").bind(tenantId, sprintId).first<{ project_id: string }>();
  return Boolean(row) && row?.project_id === projectId;
}

export async function handleSprints(request: Request, env: Env, caller: Caller, path: string): Promise<Response | null> {
  const projectMatch = path.match(/^\/api\/projects\/([a-z0-9-]{1,40})\/sprints$/);
  if (projectMatch) {
    const projectId = projectMatch[1] ?? "";
    const project = await env.DB.prepare("SELECT 1 FROM projects WHERE tenant_id = ? AND id = ? AND status = 'active'").bind(caller.tenantId, projectId).first();
    if (!project) return json({ error: "Projekt nicht gefunden." }, 404);
    if (request.method === "GET") return json(await listSprints(env, caller.tenantId, projectId));
    if (request.method !== "POST") return json({ error: "Methode nicht erlaubt" }, 405);
    const input = await body(request);
    const name = typeof input?.name === "string" ? input.name.trim() : "";
    if (!name || name.length > 120) return json({ error: "Name muss 1–120 Zeichen lang sein." }, 400);
    const goal = typeof input?.goal === "string" ? input.goal.trim().slice(0, 2_000) : "";
    const startsAt = day(input?.startsAt);
    const endsAt = day(input?.endsAt);
    if (Number.isNaN(startsAt) || Number.isNaN(endsAt)) return json({ error: "Ungültiges Datum." }, 400);
    if (startsAt && endsAt && endsAt < startsAt) return json({ error: "Das Ende liegt vor dem Start." }, 400);
    const id = crypto.randomUUID();
    await env.DB.prepare("INSERT INTO sprints (id, tenant_id, project_id, name, goal, starts_at, ends_at, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
      .bind(id, caller.tenantId, projectId, name, goal || null, startsAt, endsAt, caller.actor)
      .run();
    await emit(env, { tenantId: caller.tenantId, projectId, type: "sprint_created", data: { sprintId: id, name, by: caller.actor } });
    return json((await listSprints(env, caller.tenantId, projectId)).find((sprint) => sprint.id === id), 201);
  }

  const sprintMatch = path.match(/^\/api\/sprints\/([0-9a-f-]{36})$/);
  if (!sprintMatch || request.method !== "PATCH") return null;
  const id = sprintMatch[1] ?? "";
  const existing = await env.DB.prepare("SELECT * FROM sprints WHERE tenant_id = ? AND id = ?").bind(caller.tenantId, id).first<SprintRow>();
  if (!existing) return json({ error: "Sprint nicht gefunden." }, 404);
  const input = await body(request);
  if (!input) return json({ error: "Ungültiger JSON-Body." }, 400);
  const status = input.status === undefined ? existing.status : (input.status as SprintStatus);
  if (!SPRINT_STATUSES.includes(status)) return json({ error: "Unbekannter Sprintstatus." }, 400);
  if (status !== existing.status && !NEXT[existing.status].includes(status)) return json({ error: `Übergang ${existing.status} → ${status} ist nicht erlaubt.` }, 409);
  if (status === "active" && existing.status !== "active") {
    const running = await env.DB.prepare("SELECT name FROM sprints WHERE tenant_id = ? AND project_id = ? AND status = 'active' AND id != ?")
      .bind(caller.tenantId, existing.project_id, id)
      .first<{ name: string }>();
    if (running) return json({ error: `Im Projekt läuft schon der Sprint „${running.name}“.` }, 409);
  }
  const name = typeof input.name === "string" && input.name.trim() ? input.name.trim().slice(0, 120) : existing.name;
  const goal = typeof input.goal === "string" ? input.goal.trim().slice(0, 2_000) || null : existing.goal;
  await env.DB.prepare("UPDATE sprints SET name = ?, goal = ?, status = ?, updated_at = unixepoch() WHERE tenant_id = ? AND id = ?")
    .bind(name, goal, status, caller.tenantId, id)
    .run();
  // Unfinished work of a finished sprint goes back to the backlog instead of silently staying in a closed sprint.
  if (status === "done" && existing.status !== "done") {
    await env.DB.prepare("UPDATE tasks SET sprint_id = NULL, updated_at = unixepoch() WHERE tenant_id = ? AND sprint_id = ? AND status != 'done'").bind(caller.tenantId, id).run();
  }
  await emit(env, { tenantId: caller.tenantId, projectId: existing.project_id, type: "sprint_updated", data: { sprintId: id, status, by: caller.actor } });
  return json((await listSprints(env, caller.tenantId, existing.project_id)).find((sprint) => sprint.id === id));
}
