import type { Caller } from "../auth.ts";
import type { Env } from "../env.ts";
import { emit } from "../events.ts";
import { AGENTS } from "../agents/registry.ts";

export const TASK_STATUSES = ["backlog", "ready", "in_progress", "review", "qa", "blocked", "done"] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

const PRIORITIES = ["low", "normal", "high", "urgent"] as const;
type Priority = (typeof PRIORITIES)[number];
const TRANSITIONS: Record<TaskStatus, readonly TaskStatus[]> = {
  backlog: ["ready", "blocked"],
  ready: ["backlog", "in_progress", "blocked"],
  in_progress: ["ready", "review", "blocked"],
  review: ["in_progress", "qa", "blocked"],
  qa: ["in_progress", "done", "blocked"],
  blocked: ["backlog", "ready", "in_progress", "review", "qa"],
  done: ["backlog"],
};

interface TaskRow {
  id: string;
  project_id: string | null;
  agent_id: string | null;
  parent_id: string | null;
  title: string;
  input: string | null;
  output: string | null;
  status: TaskStatus;
  description: string | null;
  acceptance_criteria: string | null;
  priority: Priority;
  story_points: number | null;
  created_by: string | null;
  created_at: number;
  updated_at: number;
  agent_name?: string | null;
  agent_role?: string | null;
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } });
}

function asTask(row: TaskRow) {
  return {
    id: row.id,
    projectId: row.project_id,
    agent: row.agent_id ? { id: row.agent_id, name: row.agent_name ?? row.agent_id, role: row.agent_role ?? "" } : null,
    parentId: row.parent_id,
    title: row.title,
    description: row.description,
    acceptanceCriteria: row.acceptance_criteria,
    input: row.input,
    output: row.output,
    status: row.status,
    priority: row.priority,
    storyPoints: row.story_points,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function parseBody(request: Request): Promise<Record<string, unknown> | null> {
  try {
    const value: unknown = await request.json();
    return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
  } catch {
    return null;
  }
}

async function loadTask(env: Env, id: string): Promise<TaskRow | null> {
  return env.DB.prepare(
    `SELECT t.*, a.name AS agent_name, a.role AS agent_role FROM tasks t
     LEFT JOIN agents a ON a.id = t.agent_id WHERE t.id = ?`,
  ).bind(id).first<TaskRow>();
}

async function publish(env: Env, caller: Caller, task: TaskRow, type: "task_created" | "task_updated") {
  await emit(env, {
    taskId: task.id,
    projectId: task.project_id ?? undefined,
    type,
    data: { status: task.status, title: task.title, by: caller.actor },
  });
}

/** Authenticated work-item API. All writes are validated here and remain visible through the shared event hub. */
export async function handleTasks(request: Request, env: Env, caller: Caller, path: string): Promise<Response | null> {
  if (path === "/api/tasks" && request.method === "GET") {
    const projectId = new URL(request.url).searchParams.get("project");
    const query = `SELECT t.*, a.name AS agent_name, a.role AS agent_role FROM tasks t
      LEFT JOIN agents a ON a.id = t.agent_id ${projectId ? "WHERE t.project_id = ?" : ""}
      ORDER BY CASE t.priority WHEN 'urgent' THEN 0 WHEN 'high' THEN 1 WHEN 'normal' THEN 2 ELSE 3 END,
      t.updated_at DESC LIMIT 300`;
    const result = projectId
      ? await env.DB.prepare(query).bind(projectId).all<TaskRow>()
      : await env.DB.prepare(query).all<TaskRow>();
    return json(result.results.map(asTask));
  }

  if (path === "/api/tasks" && request.method === "POST") {
    const input = await parseBody(request);
    if (!input) return json({ error: "Ungültiger JSON-Body." }, 400);
    const title = typeof input?.title === "string" ? input.title.trim() : "";
    if (!title || title.length > 200) return json({ error: "Titel muss 1–200 Zeichen lang sein." }, 400);
    const description = typeof input.description === "string" ? input.description.trim() : "";
    const acceptanceCriteria = typeof input.acceptanceCriteria === "string" ? input.acceptanceCriteria.trim() : "";
    const priority = input.priority;
    if (priority !== undefined && !PRIORITIES.includes(priority as Priority)) return json({ error: "Ungültige Priorität." }, 400);
    const storyPoints = input.storyPoints === undefined || input.storyPoints === null || input.storyPoints === "" ? null : Number(input.storyPoints);
    if (storyPoints !== null && (!Number.isFinite(storyPoints) || storyPoints < 0.5 || storyPoints > 100)) return json({ error: "Story Points müssen zwischen 0,5 und 100 liegen." }, 400);
    const projectId = typeof input.projectId === "string" && input.projectId ? input.projectId : "uguroezdamar";
    const project = await env.DB.prepare("SELECT 1 FROM projects WHERE id = ? AND status = 'active'").bind(projectId).first();
    if (!project) return json({ error: "Projekt nicht gefunden oder nicht aktiv." }, 400);
    const id = crypto.randomUUID();
    await env.DB.prepare(
      `INSERT INTO tasks (id, project_id, title, input, description, acceptance_criteria, priority, story_points, created_by, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'backlog')`,
    ).bind(id, projectId, title, description.slice(0, 10_000) || null, acceptanceCriteria.slice(0, 5_000) || null, priority ?? "normal", storyPoints, caller.actor).run();
    const task = await loadTask(env, id);
    if (!task) return json({ error: "Aufgabe konnte nicht geladen werden." }, 500);
    await publish(env, caller, task, "task_created");
    return json(asTask(task), 201);
  }

  const match = path.match(/^\/api\/tasks\/([0-9a-f-]{36})$/);
  if (!match || request.method !== "PATCH") return null;
  const id = match[1] ?? "";
  const existing = await loadTask(env, id);
  if (!existing) return json({ error: "Aufgabe nicht gefunden." }, 404);
  const input = await parseBody(request);
  if (!input) return json({ error: "Ungültiger JSON-Body." }, 400);

  if (input.title !== undefined) {
    if (typeof input.title !== "string" || !input.title.trim() || input.title.trim().length > 200) return json({ error: "Titel muss 1–200 Zeichen lang sein." }, 400);
  }
  if (input.status !== undefined) {
    if (!TASK_STATUSES.includes(input.status as TaskStatus)) return json({ error: "Unbekannter Aufgabenstatus." }, 400);
    const next = input.status as TaskStatus;
    if (next !== existing.status && !TRANSITIONS[existing.status].includes(next)) return json({ error: `Übergang ${existing.status} → ${next} ist nicht erlaubt.` }, 409);
  }
  if (input.priority !== undefined && !PRIORITIES.includes(input.priority as Priority)) return json({ error: "Ungültige Priorität." }, 400);
  if (input.agentId !== undefined && input.agentId !== null) {
    if (typeof input.agentId !== "string" || !AGENTS[input.agentId]) return json({ error: "Agent ist nicht für die Ausführung registriert." }, 400);
    const active = await env.DB.prepare("SELECT 1 FROM agents WHERE id = ? AND active = 1").bind(input.agentId).first();
    if (!active) return json({ error: "Agent ist nicht aktiv." }, 400);
  }
  const allowedText: ReadonlyArray<[string, string, number]> = [
    ["title", "title", 200], ["description", "description", 10_000], ["acceptanceCriteria", "acceptance_criteria", 5_000],
  ];
  for (const [key, , max] of allowedText) {
    if (input[key] !== undefined && (typeof input[key] !== "string" || (input[key] as string).length > max)) return json({ error: `${key} ist ungültig oder zu lang.` }, 400);
  }
  const points = input.storyPoints === undefined ? existing.story_points : input.storyPoints === null || input.storyPoints === "" ? null : Number(input.storyPoints);
  if (points !== null && (!Number.isFinite(points) || points < 0.5 || points > 100)) return json({ error: "Story Points müssen zwischen 0,5 und 100 liegen." }, 400);
  const agentId = input.agentId === undefined ? existing.agent_id : input.agentId as string | null;

  await env.DB.prepare(
    `UPDATE tasks SET title = ?, description = ?, acceptance_criteria = ?, status = ?, priority = ?, story_points = ?, agent_id = ?, updated_at = unixepoch() WHERE id = ?`,
  ).bind(
    input.title === undefined ? existing.title : (input.title as string).trim(),
    input.description === undefined ? existing.description : (input.description as string).trim() || null,
    input.acceptanceCriteria === undefined ? existing.acceptance_criteria : (input.acceptanceCriteria as string).trim() || null,
    input.status === undefined ? existing.status : input.status,
    input.priority === undefined ? existing.priority : input.priority,
    points,
    agentId,
    id,
  ).run();
  const task = await loadTask(env, id);
  if (!task) return json({ error: "Aufgabe konnte nicht geladen werden." }, 500);
  await publish(env, caller, task, "task_updated");
  return json(asTask(task));
}
