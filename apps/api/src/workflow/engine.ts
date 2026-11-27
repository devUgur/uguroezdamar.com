import type { Caller } from "../auth.ts";
import type { Env } from "../env.ts";
import { emit } from "../events.ts";
import { threadObjectName } from "../tenancy.ts";
import { loadTask } from "../work/tasks.ts";
import { DELIVERY, handoffOf, MAX_REWORK, stepDefinition, stepIndex, type DeliveryStep } from "./delivery.ts";
import type { WorkflowPort } from "./port.ts";
import { startStep, type WorkflowRunRow } from "./steps.ts";

/**
 * The workflow engine on SQL (ADR 0040, P3). A step is an agent run; when the run ends, the runtime reports it here
 * and the engine moves on, waits for an approval, sends the work back after QA, or hands over to Ugur. No actor of
 * its own and nothing host-specific: the same engine runs on Cloudflare and on a Node host.
 */
export class WorkflowError extends Error {
  constructor(message: string, readonly status = 409) {
    super(message);
  }
}

const OPEN = "('running', 'waiting_owner', 'awaiting_acceptance')";
const workflowCaller = (tenantId: string): Caller => ({ actor: "workflow", tenantId, scopes: [] });

async function openRun(env: Env, tenantId: string, taskId: string): Promise<WorkflowRunRow | null> {
  return env.DB.prepare(`SELECT id, tenant_id, task_id, project_id, status, step, rework FROM workflow_runs WHERE tenant_id = ? AND task_id = ? AND status IN ${OPEN}`)
    .bind(tenantId, taskId)
    .first<WorkflowRunRow>();
}

async function changed(env: Env, run: { tenant_id: string; task_id: string; project_id: string | null; id: string }, status: string, step: string, note?: string) {
  await emit(env, { tenantId: run.tenant_id, taskId: run.task_id, projectId: run.project_id ?? undefined, type: "workflow_updated", data: { workflowRunId: run.id, status, step, note } });
}

async function waitForOwner(env: Env, run: WorkflowRunRow, note: string, blockTask = false): Promise<void> {
  await env.DB.prepare("UPDATE workflow_runs SET status = 'waiting_owner', note = ?, updated_at = unixepoch() WHERE tenant_id = ? AND id = ?")
    .bind(note.slice(0, 2_000), run.tenant_id, run.id)
    .run();
  if (blockTask) {
    await env.DB.prepare("/* tenant:parent */ UPDATE tasks SET status = 'blocked', output = ?, updated_at = unixepoch() WHERE id = ? AND status IN ('in_progress', 'review')")
      .bind(note.slice(0, 5_000), run.task_id)
      .run();
  }
  await changed(env, run, "waiting_owner", run.step, note);
}

/** Starts the team on a ready task: Chef → Product Owner → Tech Lead → Developer → QA → report → Ugur's acceptance. */
export async function startDelivery(env: Env, caller: Caller, taskId: string): Promise<{ workflowRunId: string; threadId: string }> {
  const task = await loadTask(env, caller.tenantId, taskId);
  if (!task) throw new WorkflowError("Aufgabe nicht gefunden.", 404);
  if (task.status !== "ready") throw new WorkflowError("Nur Aufgaben auf „Ready“ kann das Team übernehmen.");
  if (await openRun(env, caller.tenantId, taskId)) throw new WorkflowError("Für diese Aufgabe läuft schon ein Ablauf.");
  const id = crypto.randomUUID();
  const first = DELIVERY[0]!.id;
  const claim = await env.DB.prepare("/* tenant:parent */ UPDATE tasks SET status = 'in_progress', updated_at = unixepoch() WHERE id = ? AND status = 'ready'").bind(taskId).run();
  if (!claim.meta.changes) throw new WorkflowError("Aufgabe wurde gerade geändert. Bitte neu laden.");
  await env.DB.prepare("INSERT INTO workflow_runs (id, tenant_id, task_id, project_id, status, step, started_by) VALUES (?, ?, ?, ?, 'running', ?, ?)")
    .bind(id, caller.tenantId, taskId, task.project_id, first, caller.actor)
    .run();
  const run: WorkflowRunRow = { id, tenant_id: caller.tenantId, task_id: taskId, project_id: task.project_id, status: "running", step: first, rework: 0 };
  try {
    const threadId = await startStep(env, { ...caller, actor: caller.actor }, run, first);
    await changed(env, run, "running", first);
    return { workflowRunId: id, threadId };
  } catch (error) {
    await waitForOwner(env, run, `Start fehlgeschlagen: ${error instanceof Error ? error.message : String(error)}`, true);
    throw new WorkflowError("Der Ablauf konnte nicht starten.", 502);
  }
}

/**
 * Called by the runtime when the run of a conversation ends. Only conversations that are workflow steps matter.
 * An open approval keeps the step waiting: the agent resumes after Ugur's decision and ends again later.
 */
export async function stepFinished(env: Env, input: { tenantId: string; threadId: string; outcome: "done" | "failed" | "cancelled"; output: string }): Promise<boolean> {
  const step = await env.DB.prepare(
    "SELECT id, run_id, step FROM workflow_steps WHERE tenant_id = ? AND thread_id = ? AND status IN ('running', 'waiting_approval')",
  )
    .bind(input.tenantId, input.threadId)
    .first<{ id: string; run_id: string; step: DeliveryStep }>();
  if (!step) return false;
  const run = await env.DB.prepare("SELECT id, tenant_id, task_id, project_id, status, step, rework FROM workflow_runs WHERE tenant_id = ? AND id = ?")
    .bind(input.tenantId, step.run_id)
    .first<WorkflowRunRow>();
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
    await waitForOwner(env, run, `${stepDefinition(step.step).label} ist nicht durchgelaufen: ${input.output.slice(0, 500)}`, true);
    return true;
  }
  await advance(env, run, step.step);
  return true;
}

/** How often a step already ran in this workflow; a rework round is the next attempt of "implement". */
async function attemptsOf(env: Env, run: WorkflowRunRow, step: DeliveryStep): Promise<number> {
  const row = await env.DB.prepare("SELECT COUNT(*) AS n FROM workflow_steps WHERE tenant_id = ? AND run_id = ? AND step = ?").bind(run.tenant_id, run.id, step).first<{ n: number }>();
  return row?.n ?? 0;
}

async function advance(env: Env, run: WorkflowRunRow, finished: DeliveryStep): Promise<void> {
  const caller = workflowCaller(run.tenant_id);
  if (finished === "report") {
    await env.DB.prepare("UPDATE workflow_runs SET status = 'awaiting_acceptance', note = NULL, updated_at = unixepoch() WHERE tenant_id = ? AND id = ?").bind(run.tenant_id, run.id).run();
    await changed(env, run, "awaiting_acceptance", finished);
    return;
  }
  let next = DELIVERY[stepIndex(finished) + 1]?.id;
  let note = "";
  if (finished === "qa") {
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
  if (!next) return;
  try {
    await startStep(env, caller, run, next, note, (await attemptsOf(env, run, next)) + 1);
    await changed(env, run, "running", next);
  } catch (error) {
    await waitForOwner(env, run, `${stepDefinition(next).label} konnte nicht starten: ${error instanceof Error ? error.message : String(error)}`, true);
  }
}

/** Ugur lets the current step run again (after a failure, a QA without verdict or too many rework rounds). */
export async function retryDelivery(env: Env, caller: Caller, taskId: string): Promise<void> {
  const run = await openRun(env, caller.tenantId, taskId);
  if (!run || run.status !== "waiting_owner") throw new WorkflowError("Kein Ablauf wartet hier auf dich.");
  const step = run.step === "qa" ? "implement" : run.step;
  await env.DB.prepare("/* tenant:parent */ UPDATE tasks SET status = 'in_progress', updated_at = unixepoch() WHERE id = ? AND status IN ('blocked', 'review', 'qa')").bind(taskId).run();
  await startStep(env, caller, run, step, run.step === "qa" ? "Ugur hat nach der QA eine weitere Runde gestartet." : "", (await attemptsOf(env, run, step)) + 1);
  await changed(env, run, "running", step);
}

/** Stops the workflow; the running step's agent stops too. The task keeps its status for Ugur to decide. */
export async function cancelDelivery(env: Env, caller: Caller, taskId: string): Promise<void> {
  const run = await openRun(env, caller.tenantId, taskId);
  if (!run) throw new WorkflowError("Für diese Aufgabe läuft kein Ablauf.", 404);
  const { results } = await env.DB.prepare("SELECT thread_id FROM workflow_steps WHERE tenant_id = ? AND run_id = ? AND status IN ('running', 'waiting_approval')")
    .bind(caller.tenantId, run.id)
    .all<{ thread_id: string }>();
  await env.DB.batch([
    env.DB.prepare("UPDATE workflow_runs SET status = 'cancelled', note = ?, updated_at = unixepoch() WHERE tenant_id = ? AND id = ?").bind(`Abgebrochen von ${caller.actor}`, caller.tenantId, run.id),
    env.DB.prepare("UPDATE workflow_steps SET status = 'cancelled', finished_at = unixepoch() WHERE tenant_id = ? AND run_id = ? AND status IN ('running', 'waiting_approval')").bind(caller.tenantId, run.id),
    // Open proposals of the workflow's conversations are withdrawn with it.
    env.DB.prepare(
      "UPDATE approvals SET status = 'rejected', decided_at = unixepoch() WHERE tenant_id = ? AND status = 'pending' AND thread_id IN (SELECT thread_id FROM workflow_steps WHERE tenant_id = ? AND run_id = ?)",
    ).bind(caller.tenantId, caller.tenantId, run.id),
  ]);
  for (const row of results) await env.AGENTS.get(threadObjectName(caller.tenantId, row.thread_id)).stop().catch(() => undefined);
  await changed(env, run, "cancelled", run.step);
}

/** Ugur accepted the task on the board: the workflow is done. */
export async function deliveryAccepted(env: Env, tenantId: string, taskId: string): Promise<void> {
  const run = await openRun(env, tenantId, taskId);
  if (!run) return;
  await env.DB.prepare("UPDATE workflow_runs SET status = 'done', note = NULL, updated_at = unixepoch() WHERE tenant_id = ? AND id = ?").bind(tenantId, run.id).run();
  await changed(env, run, "done", run.step);
}

export interface DeliveryView {
  id: string;
  taskId: string;
  status: string;
  step: DeliveryStep;
  rework: number;
  note: string | null;
  updatedAt: number;
  steps: { step: DeliveryStep; label: string; agentId: string; threadId: string; attempt: number; status: string; summary: string | null }[];
}

/** Open workflows and those finished in the last two weeks, with their steps, for the board. */
export async function listDeliveries(env: Env, tenantId: string): Promise<DeliveryView[]> {
  const [runs, steps] = await Promise.all([
    env.DB.prepare(
      `SELECT id, task_id, status, step, rework, note, updated_at FROM workflow_runs
        WHERE tenant_id = ? AND (status IN ${OPEN} OR updated_at > unixepoch() - 14 * 86400) ORDER BY updated_at DESC LIMIT 100`,
    ).bind(tenantId).all<{ id: string; task_id: string; status: string; step: DeliveryStep; rework: number; note: string | null; updated_at: number }>(),
    env.DB.prepare(
      `SELECT s.run_id, s.step, s.agent_id, s.thread_id, s.attempt, s.status, s.summary FROM workflow_steps s
         JOIN workflow_runs r ON r.id = s.run_id AND r.tenant_id = s.tenant_id
        WHERE s.tenant_id = ? AND (r.status IN ${OPEN} OR r.updated_at > unixepoch() - 14 * 86400) ORDER BY s.started_at, s.rowid`,
    ).bind(tenantId).all<{ run_id: string; step: DeliveryStep; agent_id: string; thread_id: string; attempt: number; status: string; summary: string | null }>(),
  ]);
  return runs.results.map((run) => ({
    id: run.id,
    taskId: run.task_id,
    status: run.status,
    step: run.step,
    rework: run.rework,
    note: run.note,
    updatedAt: run.updated_at,
    steps: steps.results
      .filter((step) => step.run_id === run.id)
      .map((step) => ({ step: step.step, label: stepDefinition(step.step).label, agentId: step.agent_id, threadId: step.thread_id, attempt: step.attempt, status: step.status, summary: step.summary })),
  }));
}

/** The SQL adapter of the workflow port. */
export const sqlWorkflow: WorkflowPort = {
  start: startDelivery,
  stepFinished,
  retry: retryDelivery,
  cancel: cancelDelivery,
  accepted: deliveryAccepted,
  list: listDeliveries,
};
