import { AGENTS } from "../agents/registry.ts";
import type { Caller } from "../auth.ts";
import type { Env } from "../env.ts";
import { emit } from "../events.ts";

interface RoleRow {
  id: string;
  department_id: string;
  name: string;
  purpose: string;
  responsibilities: string;
  capabilities: string;
  version: number;
}

interface AgentRow {
  id: string;
  name: string;
  active: number;
  desk_x: number | null;
  desk_y: number | null;
  version: number;
  definition_id: string | null;
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });
}

async function readBody(request: Request): Promise<Record<string, unknown> | null> {
  try {
    const value: unknown = await request.json();
    return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
  } catch {
    return null;
  }
}

function string(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized && normalized.length <= max ? normalized : null;
}

function stringList(value: unknown): string[] | null {
  if (!Array.isArray(value) || value.length > 20) return null;
  const entries = value.map((item) => string(item, 200));
  return entries.every((item): item is string => item !== null) ? [...new Set(entries)] : null;
}

function asRole(row: RoleRow) {
  const list = (value: string): string[] => {
    try {
      const parsed: unknown = JSON.parse(value);
      return Array.isArray(parsed) ? parsed.filter((entry): entry is string => typeof entry === "string") : [];
    } catch {
      return [];
    }
  };
  return {
    id: row.id,
    departmentId: row.department_id,
    name: row.name,
    purpose: row.purpose,
    responsibilities: list(row.responsibilities),
    capabilities: list(row.capabilities),
    version: row.version,
  };
}

function asInstance(row: AgentRow) {
  return {
    id: row.id,
    name: row.name,
    active: row.active === 1,
    executable: Boolean(row.definition_id && AGENTS[row.id]),
    definitionId: row.definition_id,
    desk: { x: row.desk_x, y: row.desk_y },
    version: row.version,
  };
}

async function createRole(env: Env, caller: Caller, request: Request): Promise<Response> {
  const input = await readBody(request);
  if (!input) return json({ error: "Ungültiger JSON-Body." }, 400);
  const id = string(input.id, 40);
  const departmentId = string(input.departmentId, 40);
  const name = string(input.name, 120);
  const purpose = string(input.purpose, 1_000);
  const responsibilities = stringList(input.responsibilities);
  const capabilities = stringList(input.capabilities);
  if (!id || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id) || !departmentId || !name || !purpose || !responsibilities || !capabilities) {
    return json({ error: "Rollen-ID, Abteilung, Name, Zweck sowie gültige Verantwortlichkeiten und Fähigkeiten sind erforderlich." }, 400);
  }
  if (await env.DB.prepare("SELECT 1 FROM departments WHERE id = ?").bind(departmentId).first() === null) {
    return json({ error: "Abteilung nicht gefunden." }, 404);
  }
  const existing = await env.DB.prepare("SELECT 1 FROM role_profiles WHERE id = ?").bind(id).first();
  if (existing) return json({ error: "Eine Rolle mit dieser ID existiert bereits." }, 409);

  const after = { id, departmentId, name, purpose, responsibilities, capabilities, version: 1 };
  const auditId = crypto.randomUUID();
  await env.DB.batch([
    env.DB.prepare(
      "INSERT INTO role_profiles (id, department_id, name, purpose, responsibilities, capabilities, version, last_mutation_id) VALUES (?, ?, ?, ?, ?, ?, 1, ?)",
    ).bind(id, departmentId, name, purpose, JSON.stringify(responsibilities), JSON.stringify(capabilities), auditId),
    env.DB.prepare(
      "INSERT INTO organization_audit (id, actor, scope, action, entity_id, before_state, after_state) VALUES (?, ?, 'role', 'created', ?, NULL, ?)",
    ).bind(auditId, caller.actor, id, JSON.stringify(after)),
  ]);
  await emit(env, { type: "organization_updated", data: { scope: "role", action: "created", entityId: id, version: 1, by: caller.actor } }).catch((error) => console.error("organization event failed", error));
  return json(after, 201);
}

async function updateRole(env: Env, caller: Caller, id: string, request: Request): Promise<Response> {
  const input = await readBody(request);
  if (!input) return json({ error: "Ungültiger JSON-Body." }, 400);
  const existing = await env.DB.prepare("SELECT * FROM role_profiles WHERE id = ?").bind(id).first<RoleRow>();
  if (!existing) return json({ error: "Rollenprofil nicht gefunden." }, 404);
  if (!Number.isInteger(input.version) || input.version !== existing.version) return json({ error: "Das Rollenprofil wurde zwischenzeitlich geändert. Bitte neu laden." }, 409);

  const name = input.name === undefined ? existing.name : string(input.name, 120);
  const purpose = input.purpose === undefined ? existing.purpose : string(input.purpose, 1_000);
  const responsibilities = input.responsibilities === undefined ? stringList(JSON.parse(existing.responsibilities)) : stringList(input.responsibilities);
  const capabilities = input.capabilities === undefined ? stringList(JSON.parse(existing.capabilities)) : stringList(input.capabilities);
  if (!name || !purpose || !responsibilities || !capabilities) {
    return json({ error: "Ungültige Rollenfelder. Listen dürfen maximal 20 Einträge enthalten." }, 400);
  }
  const before = asRole(existing);
  const after = { ...before, name, purpose, responsibilities, capabilities, version: existing.version + 1 };
  const mutationId = crypto.randomUUID();
  const results = await env.DB.batch([
    env.DB.prepare(
      `UPDATE role_profiles SET name = ?, purpose = ?, responsibilities = ?, capabilities = ?, version = version + 1, last_mutation_id = ?
        WHERE id = ? AND version = ?`,
    ).bind(name, purpose, JSON.stringify(responsibilities), JSON.stringify(capabilities), mutationId, id, existing.version),
    env.DB.prepare(
      `INSERT INTO organization_audit (id, actor, scope, action, entity_id, before_state, after_state)
       SELECT ?, ?, 'role', 'updated', ?, ?, ? FROM role_profiles WHERE id = ? AND last_mutation_id = ?`,
    ).bind(mutationId, caller.actor, id, JSON.stringify(before), JSON.stringify(after), id, mutationId),
  ]);
  if (!results[0]?.meta.changes || !results[1]?.meta.changes) return json({ error: "Das Rollenprofil wurde zwischenzeitlich geändert. Bitte neu laden." }, 409);
  await emit(env, { type: "organization_updated", data: { scope: "role", action: "updated", entityId: id, version: after.version, by: caller.actor } }).catch((error) => console.error("organization event failed", error));
  return json(after);
}

async function updateInstance(env: Env, caller: Caller, id: string, request: Request): Promise<Response> {
  if (!AGENTS[id]) return json({ error: "Nur registrierte Runtime-Instanzen können verwaltet werden." }, 409);
  const input = await readBody(request);
  if (!input) return json({ error: "Ungültiger JSON-Body." }, 400);
  const existing = await env.DB.prepare("SELECT id, name, active, desk_x, desk_y, version, definition_id FROM agents WHERE id = ?").bind(id).first<AgentRow>();
  if (!existing) return json({ error: "Agenteninstanz nicht gefunden." }, 404);
  if (!Number.isInteger(input.version) || input.version !== existing.version) return json({ error: "Die Agenteninstanz wurde zwischenzeitlich geändert. Bitte neu laden." }, 409);

  const name = input.name === undefined ? existing.name : string(input.name, 120);
  const active = input.active === undefined ? existing.active === 1 : input.active;
  const deskX = input.deskX === undefined ? existing.desk_x : input.deskX;
  const deskY = input.deskY === undefined ? existing.desk_y : input.deskY;
  const validDesk = (value: unknown): value is number | null => value === null ||
    (typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= 40);
  if (!name || typeof active !== "boolean" || !validDesk(deskX) || !validDesk(deskY)) {
    return json({ error: "Name, Aktivstatus und Desk-Koordinaten müssen gültig sein (X/Y jeweils 0 bis 40)." }, 400);
  }
  if (id === "chef" && !active) return json({ error: "Der einzige ausführbare Umsetzungsagent kann nicht deaktiviert werden." }, 409);
  if (existing.active === 1 && !active) {
    const busy = await env.DB.prepare(
      `SELECT 1 FROM tasks WHERE agent_id = ? AND status IN ('in_progress', 'review', 'qa')
       UNION ALL SELECT 1 FROM task_reviews WHERE reviewer_agent_id = ? AND status = 'running' LIMIT 1`,
    ).bind(id, id).first();
    if (busy) return json({ error: "Die Instanz bearbeitet noch eine Aufgabe oder Prüfung und kann deshalb nicht deaktiviert werden." }, 409);
  }

  const before = asInstance(existing);
  const after = { ...before, name, active, desk: { x: deskX, y: deskY }, version: existing.version + 1 };
  const mutationId = crypto.randomUUID();
  const workloadGuard = active ? "1 = 1" : `NOT EXISTS (
    SELECT 1 FROM tasks WHERE agent_id = agents.id AND status IN ('in_progress', 'review', 'qa')
  ) AND NOT EXISTS (
    SELECT 1 FROM task_reviews WHERE reviewer_agent_id = agents.id AND status = 'running'
  )`;
  const results = await env.DB.batch([
    env.DB.prepare(
      `UPDATE agents SET name = ?, active = ?, desk_x = ?, desk_y = ?, version = version + 1, last_mutation_id = ?
        WHERE id = ? AND version = ? AND (${workloadGuard})`,
    ).bind(name, active ? 1 : 0, deskX, deskY, mutationId, id, existing.version),
    env.DB.prepare(
      `INSERT INTO organization_audit (id, actor, scope, action, entity_id, before_state, after_state)
       SELECT ?, ?, 'instance', 'updated', ?, ?, ? FROM agents WHERE id = ? AND last_mutation_id = ?`,
    ).bind(mutationId, caller.actor, id, JSON.stringify(before), JSON.stringify(after), id, mutationId),
  ]);
  if (!results[0]?.meta.changes || !results[1]?.meta.changes) return json({ error: "Die Instanz wurde zwischenzeitlich geändert. Bitte neu laden." }, 409);
  await emit(env, { agentId: id, type: "organization_updated", data: { scope: "instance", action: "updated", entityId: id, version: after.version, by: caller.actor } }).catch((error) => console.error("organization event failed", error));
  return json(after);
}

/** Owner-scoped writes. Runtime definitions, tools, models, and hard deletes are intentionally not mutable here. */
export async function handleOrganizationManagement(
  request: Request,
  env: Env,
  caller: Caller,
  path: string,
): Promise<Response | null> {
  const create = path === "/api/organization/roles" && request.method === "POST";
  const audit = path === "/api/organization/audit" && request.method === "GET";
  const roleMatch = path.match(/^\/api\/organization\/roles\/([a-z0-9-]{1,40})$/);
  const instanceMatch = path.match(/^\/api\/organization\/instances\/([a-z0-9-]{1,40})$/);
  if (!create && !audit && !(roleMatch && request.method === "PATCH") && !(instanceMatch && request.method === "PATCH")) return null;
  if (!caller.scopes.includes("organization:write")) return json({ error: "Owner-Berechtigung organization:write erforderlich." }, 403);
  if (create) return createRole(env, caller, request);
  if (audit) {
    const limit = Math.min(Math.max(Number(new URL(request.url).searchParams.get("limit")) || 50, 1), 100);
    const { results } = await env.DB.prepare(
      "SELECT id, actor, scope, action, entity_id, before_state, after_state, created_at FROM organization_audit ORDER BY created_at DESC, id DESC LIMIT ?",
    ).bind(limit).all<{ id: string; actor: string; scope: string; action: string; entity_id: string; before_state: string | null; after_state: string; created_at: number }>();
    return json(results.map((row) => ({
      id: row.id,
      actor: row.actor,
      scope: row.scope,
      action: row.action,
      entityId: row.entity_id,
      before: row.before_state ? JSON.parse(row.before_state) as unknown : null,
      after: JSON.parse(row.after_state) as unknown,
      createdAt: row.created_at,
    })));
  }
  if (roleMatch) return updateRole(env, caller, roleMatch[1] ?? "", request);
  if (instanceMatch) return updateInstance(env, caller, instanceMatch[1] ?? "", request);
  return null;
}
