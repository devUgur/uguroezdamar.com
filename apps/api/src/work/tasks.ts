import { threadObjectName } from "../tenancy.ts";
import type { Caller } from "../auth.ts";
import type { Env } from "../env.ts";
import { emit } from "../events.ts";
import { AGENTS } from "../agents/registry.ts";
import { sprintBelongsTo } from "./sprints.ts";
import { syncTaskIssue } from "../github/issues.ts";
import { GithubAccessError } from "../github/app.ts";

export const TASK_STATUSES = ["backlog", "ready", "in_progress", "review", "qa", "blocked", "done"] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

const PRIORITIES = ["low", "normal", "high", "urgent"] as const;
type Priority = (typeof PRIORITIES)[number];
export const TRANSITIONS: Record<TaskStatus, readonly TaskStatus[]> = {
  backlog: ["ready", "blocked"],
  ready: ["backlog", "blocked"],
  in_progress: ["ready", "review", "blocked"],
  review: ["in_progress", "blocked"],
  qa: ["in_progress", "done", "blocked"],
  blocked: ["backlog", "ready", "review"],
  done: ["backlog"],
};

interface TaskRow {
  id: string;
  project_id: string | null;
  sprint_id?: string | null;
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
  completion_note: string | null;
  completed_by: string | null;
  completed_at: number | null;
  agent_name?: string | null;
  agent_role?: string | null;
  thread_id?: string | null;
  review_id?: string | null;
  review_status?: string | null;
  review_verdict?: string | null;
  review_summary?: string | null;
  review_findings?: string | null;
  review_evidence?: string | null;
  review_error?: string | null;
  review_thread_id?: string | null;
  review_created_at?: number | null;
  github_issue_number?: number | null;
  github_issue_url?: string | null;
  github_issue_state?: string | null;
}

function stringList(value: string | null | undefined): string[] {
  try {
    const parsed: unknown = value ? JSON.parse(value) : [];
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } });
}

function asTask(row: TaskRow) {
  return {
    id: row.id,
    projectId: row.project_id,
    sprintId: row.sprint_id ?? null,
    agent: row.agent_id ? { id: row.agent_id, name: row.agent_name ?? row.agent_id, role: row.agent_role ?? "" } : null,
    threadId: row.thread_id ?? null,
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
    completionNote: row.completion_note,
    completedBy: row.completed_by,
    completedAt: row.completed_at,
    latestReview: row.review_id ? {
      id: row.review_id,
      status: row.review_status,
      verdict: row.review_verdict,
      summary: row.review_summary,
      findings: stringList(row.review_findings),
      evidence: stringList(row.review_evidence),
      error: row.review_error,
      threadId: row.review_thread_id,
      createdAt: row.review_created_at,
    } : null,
    githubIssue: row.github_issue_number ? {
      number: row.github_issue_number,
      url: row.github_issue_url,
      state: row.github_issue_state,
    } : null,
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

async function loadTask(env: Env, tenantId: string, id: string): Promise<TaskRow | null> {
  return env.DB.prepare(
    `SELECT t.*, a.name AS agent_name, a.role AS agent_role,
       (SELECT id FROM threads WHERE task_id = t.id AND archived = 0 ORDER BY updated_at DESC LIMIT 1) AS thread_id,
       (SELECT id FROM task_reviews WHERE task_id = t.id ORDER BY created_at DESC, id DESC LIMIT 1) AS review_id,
       (SELECT status FROM task_reviews WHERE task_id = t.id ORDER BY created_at DESC, id DESC LIMIT 1) AS review_status,
       (SELECT verdict FROM task_reviews WHERE task_id = t.id ORDER BY created_at DESC, id DESC LIMIT 1) AS review_verdict,
       (SELECT summary FROM task_reviews WHERE task_id = t.id ORDER BY created_at DESC, id DESC LIMIT 1) AS review_summary,
       (SELECT findings FROM task_reviews WHERE task_id = t.id ORDER BY created_at DESC, id DESC LIMIT 1) AS review_findings,
       (SELECT evidence FROM task_reviews WHERE task_id = t.id ORDER BY created_at DESC, id DESC LIMIT 1) AS review_evidence,
       (SELECT error FROM task_reviews WHERE task_id = t.id ORDER BY created_at DESC, id DESC LIMIT 1) AS review_error,
       (SELECT thread_id FROM task_reviews WHERE task_id = t.id ORDER BY created_at DESC, id DESC LIMIT 1) AS review_thread_id,
       (SELECT created_at FROM task_reviews WHERE task_id = t.id ORDER BY created_at DESC, id DESC LIMIT 1) AS review_created_at
       FROM tasks t LEFT JOIN agents a ON a.id = t.agent_id WHERE t.tenant_id = ? AND t.id = ?`,
  ).bind(tenantId, id).first<TaskRow>();
}

async function publish(env: Env, caller: Caller, task: TaskRow, type: "task_created" | "task_updated") {
  await emit(env, {
    tenantId: caller.tenantId,
    taskId: task.id,
    projectId: task.project_id ?? undefined,
    type,
    data: { status: task.status, title: task.title, by: caller.actor },
  });
}

/**
 * Creates a backlog task: the board's form and the agents' task_create tool use this one path, so validation, the
 * event and the GitHub-free default (backlog, no agent) are the same for people and agents.
 */
export async function createTask(env: Env, caller: Caller, input: Record<string, unknown>): Promise<{ task: ReturnType<typeof asTask> } | { error: string }> {
  const title = typeof input.title === "string" ? input.title.trim() : "";
  if (!title || title.length > 200) return { error: "Titel muss 1–200 Zeichen lang sein." };
  const description = typeof input.description === "string" ? input.description.trim() : "";
  const acceptanceCriteria = typeof input.acceptanceCriteria === "string" ? input.acceptanceCriteria.trim() : "";
  const priority = input.priority;
  if (priority !== undefined && !PRIORITIES.includes(priority as Priority)) return { error: "Ungültige Priorität." };
  const storyPoints = input.storyPoints === undefined || input.storyPoints === null || input.storyPoints === "" ? null : Number(input.storyPoints);
  if (storyPoints !== null && (!Number.isFinite(storyPoints) || storyPoints < 0.5 || storyPoints > 100)) return { error: "Story Points müssen zwischen 0,5 und 100 liegen." };
  const projectId = typeof input.projectId === "string" && input.projectId ? input.projectId : "uguroezdamar";
  const project = await env.DB.prepare("SELECT 1 FROM projects WHERE tenant_id = ? AND id = ? AND status = 'active'").bind(caller.tenantId, projectId).first();
  if (!project) return { error: "Projekt nicht gefunden oder nicht aktiv." };
  const sprintId = typeof input.sprintId === "string" && input.sprintId ? input.sprintId : null;
  if (sprintId && !(await sprintBelongsTo(env, caller.tenantId, sprintId, projectId))) return { error: "Sprint gehört nicht zu diesem Projekt oder ist abgeschlossen." };
  const id = crypto.randomUUID();
  await env.DB.prepare(
    `INSERT INTO tasks (id, tenant_id, project_id, sprint_id, title, input, description, acceptance_criteria, priority, story_points, created_by, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'backlog')`,
  ).bind(
    id, caller.tenantId, projectId, sprintId, title,
    // `input` is the legacy copy of the description; the column list needs a value for it.
    description.slice(0, 10_000) || null, description.slice(0, 10_000) || null,
    acceptanceCriteria.slice(0, 5_000) || null, priority ?? "normal", storyPoints, caller.actor,
  ).run();
  const task = await loadTask(env, caller.tenantId, id);
  if (!task) return { error: "Aufgabe konnte nicht geladen werden." };
  await publish(env, caller, task, "task_created");
  return { task: asTask(task) };
}

/** Authenticated work-item API. All writes are validated here and remain visible through the shared event hub. */
export async function handleTasks(request: Request, env: Env, caller: Caller, path: string): Promise<Response | null> {
  if (path === "/api/tasks" && request.method === "GET") {
    const projectId = new URL(request.url).searchParams.get("project");
    const query = `SELECT t.*, a.name AS agent_name, a.role AS agent_role,
      (SELECT id FROM threads WHERE task_id = t.id AND archived = 0 ORDER BY updated_at DESC LIMIT 1) AS thread_id,
      (SELECT id FROM task_reviews WHERE task_id = t.id ORDER BY created_at DESC, id DESC LIMIT 1) AS review_id,
      (SELECT status FROM task_reviews WHERE task_id = t.id ORDER BY created_at DESC, id DESC LIMIT 1) AS review_status,
      (SELECT verdict FROM task_reviews WHERE task_id = t.id ORDER BY created_at DESC, id DESC LIMIT 1) AS review_verdict,
      (SELECT summary FROM task_reviews WHERE task_id = t.id ORDER BY created_at DESC, id DESC LIMIT 1) AS review_summary,
      (SELECT findings FROM task_reviews WHERE task_id = t.id ORDER BY created_at DESC, id DESC LIMIT 1) AS review_findings,
      (SELECT evidence FROM task_reviews WHERE task_id = t.id ORDER BY created_at DESC, id DESC LIMIT 1) AS review_evidence,
      (SELECT error FROM task_reviews WHERE task_id = t.id ORDER BY created_at DESC, id DESC LIMIT 1) AS review_error,
      (SELECT thread_id FROM task_reviews WHERE task_id = t.id ORDER BY created_at DESC, id DESC LIMIT 1) AS review_thread_id,
      (SELECT created_at FROM task_reviews WHERE task_id = t.id ORDER BY created_at DESC, id DESC LIMIT 1) AS review_created_at
      FROM tasks t
      LEFT JOIN agents a ON a.id = t.agent_id WHERE t.tenant_id = ? ${projectId ? "AND t.project_id = ?" : ""}
      ORDER BY CASE t.priority WHEN 'urgent' THEN 0 WHEN 'high' THEN 1 WHEN 'normal' THEN 2 ELSE 3 END,
      t.updated_at DESC LIMIT 300`;
    const result = projectId
      ? await env.DB.prepare(query).bind(caller.tenantId, projectId).all<TaskRow>()
      : await env.DB.prepare(query).bind(caller.tenantId).all<TaskRow>();
    return json(result.results.map(asTask));
  }

  if (path === "/api/tasks" && request.method === "POST") {
    const input = await parseBody(request);
    if (!input) return json({ error: "Ungültiger JSON-Body." }, 400);
    const created = await createTask(env, caller, input);
    return "error" in created ? json({ error: created.error }, 400) : json(created.task, 201);
  }

  const githubMatch = path.match(/^\/api\/tasks\/([0-9a-f-]{36})\/github$/);
  if (githubMatch && request.method === "POST") {
    try {
      return json(await syncTaskIssue(env, caller, githubMatch[1] ?? ""));
    } catch (error) {
      if (error instanceof GithubAccessError) return json({ error: error.message }, error.status);
      throw error;
    }
  }

  const match = path.match(/^\/api\/tasks\/([0-9a-f-]{36})(?:\/(run|review))?$/);
  if (!match || (match[2] ? request.method !== "POST" : request.method !== "PATCH")) return null;
  const id = match[1] ?? "";
  const existing = await loadTask(env, caller.tenantId, id);
  if (!existing) return json({ error: "Aufgabe nicht gefunden." }, 404);
  if (match[2] === "run") return startTaskRun(env, caller, existing);
  if (match[2] === "review") return startTaskReview(env, caller, existing);
  const input = await parseBody(request);
  if (!input) return json({ error: "Ungültiger JSON-Body." }, 400);

  if (input.title !== undefined) {
    if (typeof input.title !== "string" || !input.title.trim() || input.title.trim().length > 200) return json({ error: "Titel muss 1–200 Zeichen lang sein." }, 400);
  }
  if (input.status !== undefined) {
    if (!TASK_STATUSES.includes(input.status as TaskStatus)) return json({ error: "Unbekannter Aufgabenstatus." }, 400);
    const next = input.status as TaskStatus;
    if (next === "qa" && next !== existing.status) return json({ error: "QA wird ausschließlich über die unabhängige Reviewer-Übergabe gestartet." }, 409);
    if (next !== existing.status && !TRANSITIONS[existing.status].includes(next)) return json({ error: `Übergang ${existing.status} → ${next} ist nicht erlaubt.` }, 409);
    if (next === "done") {
      const completionNote = typeof input.completionNote === "string" ? input.completionNote.trim() : "";
      if (completionNote.length < 20 || completionNote.length > 2_000) return json({ error: "Für die Owner-Abnahme ist eine Abschlussnotiz von 20 bis 2.000 Zeichen erforderlich." }, 400);
    }
    if (input.completionNote !== undefined && (typeof input.completionNote !== "string" || input.completionNote.trim().length > 2_000)) {
      return json({ error: "Abschlussnotiz darf höchstens 2.000 Zeichen lang sein." }, 400);
    }
    if (next === "done") {
      const approved = await env.DB.prepare(
        `/* tenant:parent */ SELECT 1 FROM task_reviews WHERE task_id = ? AND status = 'completed' AND verdict = 'pass'
          AND id = (SELECT id FROM task_reviews WHERE task_id = ? ORDER BY created_at DESC, id DESC LIMIT 1) LIMIT 1`,
      ).bind(id, id).first();
      if (!approved && (typeof input.completionNote !== "string" || input.completionNote.trim().length < 20)) {
        return json({ error: "Ohne bestandenes QA-Ergebnis ist eine dokumentierte manuelle Owner-Abnahme erforderlich." }, 409);
      }
    }
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
  if (input.sprintId !== undefined) {
    if (input.sprintId !== null && (typeof input.sprintId !== "string" || !(await sprintBelongsTo(env, caller.tenantId, input.sprintId, existing.project_id)))) {
      return json({ error: "Sprint gehört nicht zu diesem Projekt oder ist abgeschlossen." }, 400);
    }
    await env.DB.prepare("UPDATE tasks SET sprint_id = ?, updated_at = unixepoch() WHERE tenant_id = ? AND id = ?").bind(input.sprintId, caller.tenantId, id).run();
  }

  const updated = await env.DB.prepare(
    `/* tenant:parent */ UPDATE tasks SET title = ?, description = ?, acceptance_criteria = ?, status = ?, priority = ?, story_points = ?, agent_id = ?,
       completion_note = CASE WHEN ? = 'done' THEN ? ELSE completion_note END,
       completed_by = CASE WHEN ? = 'done' THEN ? ELSE completed_by END,
       completed_at = CASE WHEN ? = 'done' THEN unixepoch() ELSE completed_at END,
       updated_at = unixepoch() WHERE id = ? AND status = ?`,
  ).bind(
    input.title === undefined ? existing.title : (input.title as string).trim(),
    input.description === undefined ? existing.description : (input.description as string).trim() || null,
    input.acceptanceCriteria === undefined ? existing.acceptance_criteria : (input.acceptanceCriteria as string).trim() || null,
    input.status === undefined ? existing.status : input.status,
    input.priority === undefined ? existing.priority : input.priority,
    points,
    agentId,
    input.status === "done" && existing.status !== "done" ? "done" : null,
    input.status === "done" ? String(input.completionNote).trim() : null,
    input.status === "done" && existing.status !== "done" ? "done" : null,
    caller.actor,
    input.status === "done" && existing.status !== "done" ? "done" : null,
    id,
    existing.status,
  ).run();
  if (!updated.meta.changes) return json({ error: "Aufgabe wurde gleichzeitig geändert. Bitte neu laden." }, 409);
  const task = await loadTask(env, caller.tenantId, id);
  if (!task) return json({ error: "Aufgabe konnte nicht geladen werden." }, 500);
  await publish(env, caller, task, "task_updated");
  return json(asTask(task));
}

async function startTaskReview(env: Env, caller: Caller, task: TaskRow): Promise<Response> {
  if (task.status !== "review") return json({ error: "Nur Aufgaben im Code Review können an QA übergeben werden." }, 409);
  const reviewerId = "reviewer";
  const definition = AGENTS[reviewerId];
  if (!definition) return json({ error: "QA-Reviewer ist nicht ausführbar." }, 503);
  const active = await env.DB.prepare("SELECT 1 FROM agents WHERE id = ? AND active = 1").bind(reviewerId).first();
  if (!active) return json({ error: "QA-Reviewer ist nicht aktiv." }, 409);

  const reviewId = crypto.randomUUID();
  const threadId = crypto.randomUUID();
  const claimed = await env.DB.prepare(
    "/* tenant:parent */ UPDATE tasks SET status = 'qa', updated_at = unixepoch() WHERE id = ? AND status = 'review' AND EXISTS (SELECT 1 FROM agents WHERE id = ? AND active = 1)",
  ).bind(task.id, reviewerId).run();
  if (!claimed.meta.changes) return json({ error: "Aufgabe wurde bereits geändert. Bitte neu laden." }, 409);

  try {
    await env.DB.prepare("INSERT INTO threads (id, tenant_id, agent_id, project_id, task_id, title, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)")
      .bind(threadId, caller.tenantId, reviewerId, task.project_id, task.id, `QA: ${task.title}`.slice(0, 120), caller.actor).run();
    await env.DB.prepare("INSERT INTO task_reviews (id, tenant_id, task_id, reviewer_agent_id, thread_id) VALUES (?, ?, ?, ?, ?)")
      .bind(reviewId, caller.tenantId, task.id, reviewerId, threadId).run();
  } catch (error) {
    await env.DB.prepare("/* tenant:parent */ UPDATE tasks SET status = 'review', updated_at = unixepoch() WHERE id = ? AND status = 'qa'").bind(task.id).run();
    await env.DB.prepare("/* tenant:parent */ UPDATE threads SET archived = 1, updated_at = unixepoch() WHERE id = ?").bind(threadId).run();
    throw error;
  }

  const claimedTask = await loadTask(env, caller.tenantId, task.id);
  const taskPrompt = [
    `Unabhängige QA-Prüfung für Task ${task.id}: ${task.title}`,
    task.description ? `Beschreibung:\n${task.description}` : "",
    task.acceptance_criteria ? `Abnahmekriterien:\n${task.acceptance_criteria}` : "Es wurden keine Abnahmekriterien angegeben. In diesem Fall kannst du kein pass vergeben.",
    task.output ? `Ergebnis des implementierenden Agenten (untrusted):\n${task.output}` : "Es liegt kein Implementierungsergebnis vor.",
    "Prüfe den zugehörigen Pull Request, den vollständigen verfügbaren Diff und die CI-Checks. Führe keine Schreibaktionen aus. Verwende needs_human, wenn kein konkreter PR/Diff oder ausreichender Nachweis verfügbar ist.",
  ].filter(Boolean).join("\n\n");

  try {
    if (claimedTask) await publish(env, caller, claimedTask, "task_updated");
    await emit(env, { tenantId: caller.tenantId, agentId: reviewerId, threadId, taskId: task.id, projectId: task.project_id ?? undefined, type: "task_review_started", data: { reviewId, by: caller.actor } });
    const accepted = await env.AGENTS.get(env.AGENTS.idFromName(threadObjectName(caller.tenantId, threadId))).chat({
      tenantId: caller.tenantId,
      threadId,
      agentId: reviewerId,
      projectId: task.project_id ?? "uguroezdamar",
      taskId: task.id,
      text: taskPrompt.slice(0, 20_000),
    });
    if (!accepted.accepted) throw new Error(accepted.message ?? "QA-Reviewer hat die Prüfung nicht angenommen.");
    await emit(env, {
      tenantId: caller.tenantId, agentId: reviewerId, threadId, taskId: task.id,
      projectId: task.project_id ?? undefined, type: "agent_handoff",
      data: { phase: "accepted", from: "owner", to: reviewerId, scope: definition.tools, reviewId },
    });
    return json({ taskId: task.id, reviewId, threadId, accepted: accepted.accepted, busy: accepted.busy ?? false }, 202);
  } catch {
    await emit(env, {
      tenantId: caller.tenantId, agentId: reviewerId, threadId, taskId: task.id,
      projectId: task.project_id ?? undefined, type: "agent_handoff",
      data: { phase: "failed", from: "owner", to: reviewerId, scope: definition.tools, reviewId },
    });
    await env.DB.batch([
      env.DB.prepare("/* tenant:parent */ UPDATE task_reviews SET status = 'failed', error = 'QA-Lauf konnte nicht gestartet werden.', completed_at = unixepoch() WHERE id = ? AND status = 'running'").bind(reviewId),
      env.DB.prepare("/* tenant:parent */ UPDATE tasks SET status = 'review', updated_at = unixepoch() WHERE id = ? AND status = 'qa'").bind(task.id),
      env.DB.prepare("/* tenant:parent */ UPDATE threads SET archived = 1, updated_at = unixepoch() WHERE id = ?").bind(threadId),
    ]);
    return json({ error: "QA-Lauf konnte nicht gestartet werden." }, 502);
  }
}

async function startTaskRun(env: Env, caller: Caller, task: TaskRow): Promise<Response> {
  if (task.status !== "ready") return json({ error: "Nur bereite Aufgaben können gestartet werden." }, 409);
  const agentId = task.agent_id ?? "chef";
  const definition = AGENTS[agentId];
  if (!definition) return json({ error: "Der zugewiesene Agent ist nicht ausführbar." }, 409);
  const active = await env.DB.prepare("SELECT 1 FROM agents WHERE id = ? AND active = 1").bind(agentId).first();
  if (!active) return json({ error: "Der zugewiesene Agent ist nicht aktiv." }, 409);
  const threadId = crypto.randomUUID();
  const taskPrompt = [
    `Arbeitsauftrag ${task.id}: ${task.title}`,
    task.description ? `Beschreibung:\n${task.description}` : "",
    task.acceptance_criteria ? `Abnahmekriterien:\n${task.acceptance_criteria}` : "",
    "Arbeite ausschließlich an diesem Auftrag. Halte dich an Repository-Regeln, Tool-Grenzen und erforderliche Freigaben. Melde Ergebnis, offene Punkte und Verifikationsstatus. Markiere die Aufgabe nicht selbst als abgeschlossen.",
  ].filter(Boolean).join("\n\n");

  const claim = await env.DB.prepare(
    "/* tenant:parent */ UPDATE tasks SET agent_id = ?, status = 'in_progress', updated_at = unixepoch() WHERE id = ? AND status = 'ready' AND EXISTS (SELECT 1 FROM agents WHERE id = ? AND active = 1)",
  ).bind(agentId, task.id, agentId).run();
  if (!claim.meta.changes) return json({ error: "Aufgabe wurde bereits geändert oder gestartet." }, 409);
  try {
    await env.DB.prepare("INSERT INTO threads (id, tenant_id, agent_id, project_id, task_id, title, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)")
      .bind(threadId, caller.tenantId, agentId, task.project_id, task.id, task.title.slice(0, 120), caller.actor).run();
  } catch (error) {
    await env.DB.prepare("/* tenant:parent */ UPDATE tasks SET agent_id = ?, status = 'ready', updated_at = unixepoch() WHERE id = ? AND status = 'in_progress'")
      .bind(task.agent_id, task.id).run();
    throw error;
  }
  const assigned = await loadTask(env, caller.tenantId, task.id);
  if (assigned) await publish(env, caller, assigned, "task_updated");

  try {
    const accepted = await env.AGENTS.get(env.AGENTS.idFromName(threadObjectName(caller.tenantId, threadId))).chat({
      tenantId: caller.tenantId,
      threadId,
      agentId,
      projectId: task.project_id ?? "uguroezdamar",
      taskId: task.id,
      text: taskPrompt.slice(0, 20_000),
    });
    if (!accepted.accepted) throw new Error(accepted.message ?? "Der Agent hat den Auftrag nicht angenommen.");
    await emit(env, {
      tenantId: caller.tenantId, agentId, threadId, taskId: task.id,
      projectId: task.project_id ?? undefined, type: "agent_handoff",
      data: { phase: "accepted", from: "owner", to: agentId, scope: definition.tools },
    });
    return json({ taskId: task.id, threadId, accepted: accepted.accepted, busy: accepted.busy ?? false }, 202);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Agentenlauf konnte nicht gestartet werden.";
    await env.DB.prepare("/* tenant:parent */ UPDATE tasks SET status = 'blocked', output = ?, updated_at = unixepoch() WHERE id = ? AND status = 'in_progress'")
      .bind(`Startfehler: ${message}`.slice(0, 5_000), task.id).run();
    const blocked = await loadTask(env, caller.tenantId, task.id);
    if (blocked) await publish(env, caller, blocked, "task_updated");
    await emit(env, {
      tenantId: caller.tenantId, agentId, threadId, taskId: task.id,
      projectId: task.project_id ?? undefined, type: "agent_handoff",
      data: { phase: "failed", from: "owner", to: agentId, scope: definition.tools },
    });
    await env.DB.prepare("/* tenant:parent */ UPDATE threads SET archived = 1, updated_at = unixepoch() WHERE id = ?").bind(threadId).run();
    return json({ error: "Agentenlauf konnte nicht gestartet werden." }, 502);
  }
}
