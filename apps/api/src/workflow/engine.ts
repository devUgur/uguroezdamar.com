import type { Caller } from "../auth.ts";
import type { Env } from "../env.ts";
import { emit } from "../events.ts";
import { threadObjectName } from "../tenancy.ts";
import { loadTask } from "../work/tasks.ts";
import { handoffOf, MAX_REWORK } from "./delivery.ts";
import { flowOf, nextStep, stepDefinition } from "./flows.ts";
import { conceptVerdict, MAX_CONCEPT_REWORK } from "./planning.ts";
import type { WorkflowPort } from "./port.ts";
import { startStep, type WorkflowRunRow } from "./steps.ts";

/**
 * The workflow engine on SQL (ADR 0040 P3, ADR 0041). A step is an agent run; when the run ends, the runtime reports
 * it here and the engine moves on, waits for an approval or Ugur's answers, sends work back after a review, or hands
 * over to Ugur. Two workflows: `delivery` (one task through the team) and `planning` (an initiative to a backlog and
 * a sprint). Nothing host-specific: the same engine runs on Cloudflare and on a Node host.
 */
export class WorkflowError extends Error {
  constructor(message: string, readonly status = 409) {
    super(message);
  }
}

const OPEN = "('running', 'waiting_owner', 'awaiting_acceptance')";
const RUN_COLUMNS = "id, tenant_id, task_id, project_id, status, kind, step, rework";
export const workflowCaller = (tenantId: string): Caller => ({ actor: "workflow", tenantId, scopes: [] });

async function openRun(env: Env, tenantId: string, taskId: string): Promise<WorkflowRunRow | null> {
  return env.DB.prepare(`SELECT ${RUN_COLUMNS} FROM workflow_runs WHERE tenant_id = ? AND task_id = ? AND status IN ${OPEN}`)
    .bind(tenantId, taskId)
    .first<WorkflowRunRow>();
}

async function changed(env: Env, run: WorkflowRunRow, status: string, step: string, note?: string) {
  await emit(env, { tenantId: run.tenant_id, taskId: run.task_id, projectId: run.project_id ?? undefined, type: "workflow_updated", data: { workflowRunId: run.id, kind: run.kind, status, step, note } });
}

async function waitForOwner(env: Env, run: WorkflowRunRow, note: string, blockTask = false): Promise<void> {
  await env.DB.prepare("UPDATE workflow_runs SET status = 'waiting_owner', note = ?, updated_at = unixepoch() WHERE tenant_id = ? AND id = ?")
    .bind(note.slice(0, 2_000), run.tenant_id, run.id)
    .run();
  if (blockTask && run.kind === "delivery") {
    await env.DB.prepare("/* tenant:parent */ UPDATE tasks SET status = 'blocked', output = ?, updated_at = unixepoch() WHERE id = ? AND status IN ('in_progress', 'review')")
      .bind(note.slice(0, 5_000), run.task_id)
      .run();
  }
  await changed(env, run, "waiting_owner", run.step, note);
}

async function attemptsOf(env: Env, run: WorkflowRunRow, step: string): Promise<number> {
  const row = await env.DB.prepare("SELECT COUNT(*) AS n FROM workflow_steps WHERE tenant_id = ? AND run_id = ? AND step = ?").bind(run.tenant_id, run.id, step).first<{ n: number }>();
  return row?.n ?? 0;
}

async function begin(env: Env, caller: Caller, kind: "delivery" | "planning", task: { id: string; project_id: string | null }): Promise<{ workflowRunId: string; threadId: string }> {
  const id = crypto.randomUUID();
  const first = flowOf(kind)[0]!.id;
  await env.DB.prepare("INSERT INTO workflow_runs (id, tenant_id, task_id, project_id, kind, status, step, started_by) VALUES (?, ?, ?, ?, ?, 'running', ?, ?)")
    .bind(id, caller.tenantId, task.id, task.project_id, kind, first, caller.actor)
    .run();
  const run: WorkflowRunRow = { id, tenant_id: caller.tenantId, task_id: task.id, project_id: task.project_id, status: "running", kind, step: first, rework: 0 };
  try {
    const threadId = await startStep(env, caller, run, first);
    await changed(env, run, "running", first);
    return { workflowRunId: id, threadId };
  } catch (error) {
    await waitForOwner(env, run, `Start fehlgeschlagen: ${error instanceof Error ? error.message : String(error)}`, true);
    throw new WorkflowError("Der Ablauf konnte nicht starten.", 502);
  }
}

/** Starts the team on a ready task: Chef → Product Owner → Tech Lead → Developer → QA → report → Ugur's acceptance. */
export async function startDelivery(env: Env, caller: Caller, taskId: string): Promise<{ workflowRunId: string; threadId: string }> {
  const task = await loadTask(env, caller.tenantId, taskId);
  if (!task) throw new WorkflowError("Aufgabe nicht gefunden.", 404);
  if (task.status !== "ready") throw new WorkflowError("Nur Aufgaben auf „Ready“ kann das Team übernehmen.");
  if (await openRun(env, caller.tenantId, taskId)) throw new WorkflowError("Für diese Aufgabe läuft schon ein Ablauf.");
  const claim = await env.DB.prepare("/* tenant:parent */ UPDATE tasks SET status = 'in_progress', updated_at = unixepoch() WHERE id = ? AND status = 'ready'").bind(taskId).run();
  if (!claim.meta.changes) throw new WorkflowError("Aufgabe wurde gerade geändert. Bitte neu laden.");
  return begin(env, caller, "delivery", task);
}

/** Starts the planning of an initiative (ADR 0041): from Ugur's wish to concept, backlog and a proposed sprint. */
export async function startPlanning(env: Env, caller: Caller, initiativeId: string): Promise<{ workflowRunId: string; threadId: string }> {
  const task = await loadTask(env, caller.tenantId, initiativeId);
  if (!task || (task as { kind?: string }).kind !== "initiative") throw new WorkflowError("Vorhaben nicht gefunden.", 404);
  if (await openRun(env, caller.tenantId, initiativeId)) throw new WorkflowError("Für dieses Vorhaben läuft schon eine Planung.");
  return begin(env, caller, "planning", task);
}

/**
 * Called by the runtime when the run of a conversation ends. Only conversations that are workflow steps matter.
 * An open approval keeps the step waiting: the agent resumes after Ugur's decision and ends again later.
 */
export async function stepFinished(env: Env, input: { tenantId: string; threadId: string; outcome: "done" | "failed" | "cancelled"; output: string }): Promise<boolean> {
  const step = await env.DB.prepare(
    "SELECT id, run_id, step, agent_id FROM workflow_steps WHERE tenant_id = ? AND thread_id = ? AND status IN ('running', 'waiting_approval')",
  )
    .bind(input.tenantId, input.threadId)
    .first<{ id: string; run_id: string; step: string; agent_id: string }>();
  if (!step) return false;
  const run = await env.DB.prepare(`SELECT ${RUN_COLUMNS} FROM workflow_runs WHERE tenant_id = ? AND id = ?`).bind(input.tenantId, step.run_id).first<WorkflowRunRow>();
  if (!run || run.status === "cancelled" || run.status === "done") return true;

  const pending = await env.DB.prepare("SELECT 1 FROM approvals WHERE tenant_id = ? AND thread_id = ? AND status = 'pending'").bind(input.tenantId, input.threadId).first();
  if (input.outcome === "done" && pending) {
    await env.DB.prepare("UPDATE workflow_steps SET status = 'waiting_approval' WHERE tenant_id = ? AND id = ?").bind(input.tenantId, step.id).run();
    await changed(env, run, "running", step.step, "wartet auf deine Freigabe");
    return true;
  }

  const summary = input.outcome === "done" ? handoffOf(input.output) : input.output.slice(0, 2_000);
  const closed = await env.DB.prepare(
    "UPDATE workflow_steps SET status = ?, summary = ?, finished_at = unixepoch() WHERE tenant_id = ? AND id = ? AND status IN ('running', 'waiting_approval')",
  )
    .bind(input.outcome === "done" ? "done" : "failed", summary, input.tenantId, step.id)
    .run();
  if (!closed.meta.changes) return true;

  if (input.outcome !== "done") {
    await waitForOwner(env, run, `${stepDefinition(run.kind, step.step).label} ist nicht durchgelaufen: ${input.output.slice(0, 500)}`, true);
    return true;
  }
  if (run.kind === "planning") {
    // The full answer is the step's artifact; the next roles read it, Ugur sees it in the office.
    await env.DB.prepare(
      `INSERT INTO planning_artifacts (tenant_id, initiative_id, kind, version, content, agent_id, thread_id)
       VALUES (?, ?, ?, COALESCE((SELECT MAX(version) FROM planning_artifacts WHERE tenant_id = ? AND initiative_id = ? AND kind = ?), 0) + 1, ?, ?, ?)`,
    )
      .bind(input.tenantId, run.task_id, step.step, input.tenantId, run.task_id, step.step, input.output.slice(0, 60_000), step.agent_id, input.threadId)
      .run();
    const open = await env.DB.prepare("SELECT COUNT(*) AS n FROM owner_questions WHERE tenant_id = ? AND initiative_id = ? AND answer IS NULL").bind(input.tenantId, run.task_id).first<{ n: number }>();
    if (open?.n) {
      await waitForOwner(env, run, `${open.n} Rückfrage(n) an dich. Mit deinen Antworten läuft „${stepDefinition(run.kind, step.step).label}“ erneut.`);
      return true;
    }
  }
  await advance(env, run, step.step, input.output);
  return true;
}

async function advance(env: Env, run: WorkflowRunRow, finished: string, output: string): Promise<void> {
  const caller = workflowCaller(run.tenant_id);
  if ((run.kind === "delivery" && finished === "report") || (run.kind === "planning" && finished === "summary")) {
    await env.DB.prepare("UPDATE workflow_runs SET status = 'awaiting_acceptance', note = NULL, updated_at = unixepoch() WHERE tenant_id = ? AND id = ?").bind(run.tenant_id, run.id).run();
    await changed(env, run, "awaiting_acceptance", finished);
    if (run.kind === "delivery") await continueSprintOf(env, run.tenant_id, run.task_id);
    return;
  }
  let next = nextStep(run.kind, finished);
  let note = "";
  if (run.kind === "delivery" && finished === "qa") {
    const review = await env.DB.prepare("/* tenant:parent */ SELECT verdict, summary, findings FROM task_reviews WHERE task_id = ? ORDER BY created_at DESC, id DESC LIMIT 1")
      .bind(run.task_id)
      .first<{ verdict: string | null; summary: string | null; findings: string | null }>();
    if (review?.verdict === "changes_requested") {
      if (run.rework >= MAX_REWORK) {
        await waitForOwner(env, run, `QA hat die Arbeit ${run.rework + 1}-mal zurückgegeben: ${review.summary ?? ""}`);
        return;
      }
      await env.DB.prepare("UPDATE workflow_runs SET rework = rework + 1 WHERE tenant_id = ? AND id = ?").bind(run.tenant_id, run.id).run();
      next = "implement";
      note = `QA hat Nacharbeit verlangt. Befund: ${review.summary ?? ""}\n${review.findings ?? ""}`.slice(0, 4_000);
    } else if (review?.verdict !== "pass") {
      await waitForOwner(env, run, `QA braucht deine Einschätzung: ${review?.summary ?? "kein Ergebnis"}`);
      return;
    }
  }
  if (run.kind === "planning" && finished === "review") {
    const verdict = conceptVerdict(output);
    if (verdict.verdict === "changes_requested" && run.rework < MAX_CONCEPT_REWORK) {
      await env.DB.prepare("UPDATE workflow_runs SET rework = rework + 1 WHERE tenant_id = ? AND id = ?").bind(run.tenant_id, run.id).run();
      next = "architecture";
      note = `Die Konzeptprüfung verlangt Nacharbeit:\n${verdict.summary}`.slice(0, 4_000);
    } else if (verdict.verdict !== "pass") {
      await waitForOwner(env, run, `Die Konzeptprüfung braucht deine Entscheidung: ${verdict.summary}`);
      return;
    }
  }
  if (!next) return;
  try {
    await startStep(env, caller, run, next, note, (await attemptsOf(env, run, next)) + 1);
    await changed(env, run, "running", next);
  } catch (error) {
    await waitForOwner(env, run, `${stepDefinition(run.kind, next).label} konnte nicht starten: ${error instanceof Error ? error.message : String(error)}`, true);
  }
}

/** Ugur lets the waiting step run again: after a failure, his answers to questions, or a review without verdict. */
export async function retryWorkflow(env: Env, caller: Caller, taskId: string, note = ""): Promise<void> {
  const run = await openRun(env, caller.tenantId, taskId);
  if (!run || run.status !== "waiting_owner") throw new WorkflowError("Kein Ablauf wartet hier auf dich.");
  const step = run.kind === "delivery" && run.step === "qa" ? "implement" : run.step;
  if (run.kind === "delivery") {
    await env.DB.prepare("/* tenant:parent */ UPDATE tasks SET status = 'in_progress', updated_at = unixepoch() WHERE id = ? AND status IN ('blocked', 'review', 'qa')").bind(taskId).run();
  }
  const reason = note || (run.kind === "delivery" && run.step === "qa" ? "Ugur hat nach der QA eine weitere Runde gestartet." : "");
  await startStep(env, caller, run, step, reason, (await attemptsOf(env, run, step)) + 1);
  await changed(env, run, "running", step);
}

/** Stops the workflow; the running step's agent stops too, its open proposals are withdrawn. */
export async function cancelWorkflow(env: Env, caller: Caller, taskId: string): Promise<void> {
  const run = await openRun(env, caller.tenantId, taskId);
  if (!run) throw new WorkflowError("Hier läuft kein Ablauf.", 404);
  const { results } = await env.DB.prepare("SELECT thread_id FROM workflow_steps WHERE tenant_id = ? AND run_id = ? AND status IN ('running', 'waiting_approval')")
    .bind(caller.tenantId, run.id)
    .all<{ thread_id: string }>();
  await env.DB.batch([
    env.DB.prepare("UPDATE workflow_runs SET status = 'cancelled', note = ?, updated_at = unixepoch() WHERE tenant_id = ? AND id = ?").bind(`Abgebrochen von ${caller.actor}`, caller.tenantId, run.id),
    env.DB.prepare("UPDATE workflow_steps SET status = 'cancelled', finished_at = unixepoch() WHERE tenant_id = ? AND run_id = ? AND status IN ('running', 'waiting_approval')").bind(caller.tenantId, run.id),
    env.DB.prepare(
      "UPDATE approvals SET status = 'rejected', decided_at = unixepoch() WHERE tenant_id = ? AND status = 'pending' AND thread_id IN (SELECT thread_id FROM workflow_steps WHERE tenant_id = ? AND run_id = ?)",
    ).bind(caller.tenantId, caller.tenantId, run.id),
  ]);
  for (const row of results) await env.AGENTS.get(threadObjectName(caller.tenantId, row.thread_id)).stop().catch(() => undefined);
  await changed(env, run, "cancelled", run.step);
}

/** Ugur accepted the task on the board: the workflow is done, and its sprint moves on. */
export async function deliveryAccepted(env: Env, tenantId: string, taskId: string): Promise<void> {
  const run = await openRun(env, tenantId, taskId);
  if (run) {
    await env.DB.prepare("UPDATE workflow_runs SET status = 'done', note = NULL, updated_at = unixepoch() WHERE tenant_id = ? AND id = ?").bind(tenantId, run.id).run();
    await changed(env, run, "done", run.step);
  }
  await continueSprintOf(env, tenantId, taskId);
}

/**
 * Ugur approves the planning: the proposed sprint becomes active, its tickets ready, and the team starts on the first
 * ticket whose dependencies are met. The rest of the backlog waits for the next sprint.
 */
export async function approvePlanning(env: Env, caller: Caller, initiativeId: string): Promise<{ sprintId: string | null; started: string | null }> {
  const run = await openRun(env, caller.tenantId, initiativeId);
  if (!run || run.kind !== "planning" || run.status !== "awaiting_acceptance") throw new WorkflowError("Die Planung ist noch nicht zur Freigabe bereit.");
  const sprint = await env.DB.prepare(
    `SELECT s.id FROM sprints s WHERE s.tenant_id = ? AND s.status = 'planned' AND EXISTS (
       SELECT 1 FROM tasks t WHERE t.tenant_id = s.tenant_id AND t.sprint_id = s.id AND (t.parent_id = ? OR t.parent_id IN (SELECT id FROM tasks WHERE tenant_id = s.tenant_id AND parent_id = ?)))
     ORDER BY s.created_at LIMIT 1`,
  )
    .bind(caller.tenantId, initiativeId, initiativeId)
    .first<{ id: string }>();
  const statements = [env.DB.prepare("UPDATE workflow_runs SET status = 'done', note = ?, updated_at = unixepoch() WHERE tenant_id = ? AND id = ?").bind(`Freigegeben von ${caller.actor}`, caller.tenantId, run.id)];
  if (sprint) {
    statements.push(
      env.DB.prepare("UPDATE sprints SET status = 'active', starts_at = COALESCE(starts_at, unixepoch()), updated_at = unixepoch() WHERE tenant_id = ? AND id = ?").bind(caller.tenantId, sprint.id),
      env.DB.prepare("UPDATE tasks SET status = 'ready', updated_at = unixepoch() WHERE tenant_id = ? AND sprint_id = ? AND status = 'backlog' AND kind IN ('story', 'task')").bind(caller.tenantId, sprint.id),
    );
  }
  await env.DB.batch(statements);
  await changed(env, run, "done", run.step, "Planung freigegeben");
  const started = sprint ? await continueSprint(env, caller.tenantId, sprint.id) : null;
  return { sprintId: sprint?.id ?? null, started };
}

async function continueSprintOf(env: Env, tenantId: string, taskId: string): Promise<void> {
  const task = await env.DB.prepare("SELECT sprint_id FROM tasks WHERE tenant_id = ? AND id = ?").bind(tenantId, taskId).first<{ sprint_id: string | null }>();
  if (task?.sprint_id) await continueSprint(env, tenantId, task.sprint_id);
}

/**
 * The sprint cycle: one ticket at a time goes through the team. The next starts when no delivery of the sprint is
 * running or waiting for Ugur, picking a ready ticket whose dependencies are done or ready for acceptance.
 */
export async function continueSprint(env: Env, tenantId: string, sprintId: string): Promise<string | null> {
  const sprint = await env.DB.prepare("SELECT status FROM sprints WHERE tenant_id = ? AND id = ?").bind(tenantId, sprintId).first<{ status: string }>();
  if (sprint?.status !== "active") return null;
  const busy = await env.DB.prepare(
    "SELECT 1 FROM workflow_runs r JOIN tasks t ON t.id = r.task_id AND t.tenant_id = r.tenant_id WHERE r.tenant_id = ? AND r.kind = 'delivery' AND r.status IN ('running', 'waiting_owner') AND t.sprint_id = ?",
  ).bind(tenantId, sprintId).first();
  if (busy) return null;
  const next = await env.DB.prepare(
    `SELECT t.id FROM tasks t
      WHERE t.tenant_id = ? AND t.sprint_id = ? AND t.status = 'ready' AND t.kind IN ('story', 'task')
        AND NOT EXISTS (SELECT 1 FROM task_dependencies d JOIN tasks b ON b.id = d.depends_on AND b.tenant_id = d.tenant_id
                         WHERE d.tenant_id = t.tenant_id AND d.task_id = t.id AND b.status NOT IN ('done', 'qa'))
      ORDER BY CASE t.priority WHEN 'urgent' THEN 0 WHEN 'high' THEN 1 WHEN 'normal' THEN 2 ELSE 3 END, t.created_at, t.rowid LIMIT 1`,
  ).bind(tenantId, sprintId).first<{ id: string }>();
  if (!next) return null;
  try {
    await startDelivery(env, workflowCaller(tenantId), next.id);
    return next.id;
  } catch (error) {
    console.error("sprint could not start the next ticket", error instanceof Error ? error.message : error);
    return null;
  }
}

export interface WorkflowView {
  id: string;
  taskId: string;
  kind: string;
  status: string;
  step: string;
  rework: number;
  note: string | null;
  updatedAt: number;
  steps: { step: string; label: string; agentId: string; threadId: string; attempt: number; status: string; summary: string | null }[];
}

/** Open workflows of a kind and those finished in the last two weeks, with their steps. */
export async function listWorkflows(env: Env, tenantId: string, kind: "delivery" | "planning"): Promise<WorkflowView[]> {
  const [runs, steps] = await Promise.all([
    env.DB.prepare(
      `SELECT id, task_id, kind, status, step, rework, note, updated_at FROM workflow_runs
        WHERE tenant_id = ? AND kind = ? AND (status IN ${OPEN} OR updated_at > unixepoch() - 14 * 86400) ORDER BY updated_at DESC LIMIT 100`,
    ).bind(tenantId, kind).all<{ id: string; task_id: string; kind: string; status: string; step: string; rework: number; note: string | null; updated_at: number }>(),
    env.DB.prepare(
      `SELECT s.run_id, s.step, s.agent_id, s.thread_id, s.attempt, s.status, s.summary FROM workflow_steps s
         JOIN workflow_runs r ON r.id = s.run_id AND r.tenant_id = s.tenant_id
        WHERE s.tenant_id = ? AND r.kind = ? AND (r.status IN ${OPEN} OR r.updated_at > unixepoch() - 14 * 86400) ORDER BY s.started_at, s.rowid`,
    ).bind(tenantId, kind).all<{ run_id: string; step: string; agent_id: string; thread_id: string; attempt: number; status: string; summary: string | null }>(),
  ]);
  return runs.results.map((run) => ({
    id: run.id,
    taskId: run.task_id,
    kind: run.kind,
    status: run.status,
    step: run.step,
    rework: run.rework,
    note: run.note,
    updatedAt: run.updated_at,
    steps: steps.results
      .filter((step) => step.run_id === run.id)
      .map((step) => ({ step: step.step, label: stepDefinition(run.kind, step.step).label, agentId: step.agent_id, threadId: step.thread_id, attempt: step.attempt, status: step.status, summary: step.summary })),
  }));
}

export type DeliveryView = WorkflowView;
export const listDeliveries = (env: Env, tenantId: string) => listWorkflows(env, tenantId, "delivery");
export const retryDelivery = (env: Env, caller: Caller, taskId: string) => retryWorkflow(env, caller, taskId);
export const cancelDelivery = cancelWorkflow;

/** The SQL adapter of the workflow port. */
export const sqlWorkflow: WorkflowPort = {
  start: startDelivery,
  stepFinished,
  retry: retryDelivery,
  cancel: cancelWorkflow,
  accepted: deliveryAccepted,
  list: listDeliveries,
};
