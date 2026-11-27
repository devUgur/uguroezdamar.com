import type { Caller } from "../auth.ts";
import type { Env } from "../env.ts";
import { approvePlanning, cancelWorkflow, listWorkflows, retryWorkflow, startPlanning, WorkflowError } from "../workflow/engine.ts";
import { createTask } from "./tasks.ts";

/**
 * Initiatives (ADR 0041): Ugur describes what he wants; the team plans it. An initiative is a task of kind
 * "initiative"; its planning runs as the workflow "planning". These routes start it, answer its questions, show its
 * artifacts and let Ugur approve the plan.
 */
function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } });
}

export async function createInitiative(env: Env, caller: Caller, input: { projectId: string; title: string; brief: string }): Promise<{ initiativeId: string } | { error: string }> {
  const brief = input.brief.trim();
  if (brief.length < 20) return { error: "Beschreibe das Vorhaben in ein paar Sätzen (mindestens 20 Zeichen)." };
  const created = await createTask(env, caller, { kind: "initiative", projectId: input.projectId, title: input.title, description: brief.slice(0, 10_000), priority: "normal" });
  if ("error" in created) return created;
  try {
    await startPlanning(env, caller, created.task.id);
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Die Planung konnte nicht starten." };
  }
  return { initiativeId: created.task.id };
}

interface InitiativeRow {
  id: string;
  project_id: string;
  title: string;
  description: string | null;
  created_by: string | null;
  created_at: number;
}

export async function handleInitiatives(request: Request, env: Env, caller: Caller, path: string): Promise<Response | null> {
  if (path === "/api/initiatives" && request.method === "POST") {
    const input = (await request.json().catch(() => ({}))) as { projectId?: unknown; title?: unknown; brief?: unknown };
    if (typeof input.projectId !== "string" || typeof input.title !== "string" || typeof input.brief !== "string") return json({ error: "projectId, title und brief sind nötig." }, 400);
    const result = await createInitiative(env, caller, { projectId: input.projectId, title: input.title, brief: input.brief });
    return "error" in result ? json({ error: result.error }, 400) : json(result, 202);
  }

  if (path === "/api/initiatives" && request.method === "GET") {
    const projectId = new URL(request.url).searchParams.get("project");
    const [initiatives, workflows, questions, artifacts, counts] = await Promise.all([
      env.DB.prepare(`SELECT id, project_id, title, description, created_by, created_at FROM tasks WHERE tenant_id = ? AND kind = 'initiative' AND (? IS NULL OR project_id = ?) ORDER BY created_at DESC LIMIT 50`)
        .bind(caller.tenantId, projectId, projectId).all<InitiativeRow>(),
      listWorkflows(env, caller.tenantId, "planning"),
      env.DB.prepare("SELECT id, initiative_id, question, why, proposal, answer, asked_by FROM owner_questions WHERE tenant_id = ? ORDER BY created_at").bind(caller.tenantId).all<Record<string, string | null>>(),
      env.DB.prepare(
        `SELECT a.initiative_id, a.kind, a.version, a.content, a.agent_id, a.created_at FROM planning_artifacts a
          WHERE a.tenant_id = ? AND a.version = (SELECT MAX(b.version) FROM planning_artifacts b WHERE b.tenant_id = a.tenant_id AND b.initiative_id = a.initiative_id AND b.kind = a.kind)
          ORDER BY a.id`,
      ).bind(caller.tenantId).all<{ initiative_id: string; kind: string; version: number; content: string; agent_id: string | null; created_at: number }>(),
      env.DB.prepare(
        `SELECT root.id AS initiative_id, t.kind, COUNT(*) AS n FROM tasks root
           JOIN tasks e ON e.tenant_id = root.tenant_id AND e.parent_id = root.id
           JOIN tasks t ON t.tenant_id = root.tenant_id AND (t.id = e.id OR t.parent_id = e.id)
          WHERE root.tenant_id = ? AND root.kind = 'initiative' GROUP BY root.id, t.kind`,
      ).bind(caller.tenantId).all<{ initiative_id: string; kind: string; n: number }>(),
    ]);
    return json(initiatives.results.map((row) => ({
      id: row.id,
      projectId: row.project_id,
      title: row.title,
      brief: row.description,
      createdBy: row.created_by,
      createdAt: row.created_at,
      planning: workflows.find((workflow) => workflow.taskId === row.id) ?? null,
      questions: questions.results.filter((question) => question.initiative_id === row.id).map(({ initiative_id: _, asked_by: askedBy, ...question }) => ({ ...question, askedBy })),
      artifacts: artifacts.results.filter((artifact) => artifact.initiative_id === row.id).map(({ initiative_id: _, agent_id: agentId, created_at: createdAt, ...artifact }) => ({ ...artifact, agentId, createdAt })),
      backlog: Object.fromEntries(counts.results.filter((count) => count.initiative_id === row.id).map((count) => [count.kind, count.n])),
    })));
  }

  const match = path.match(/^\/api\/initiatives\/([0-9a-f-]{36})\/(answers|approve|cancel)$/);
  if (!match || request.method !== "POST") return null;
  const initiativeId = match[1] ?? "";
  try {
    if (match[2] === "answers") {
      const input = (await request.json().catch(() => ({}))) as { answers?: { id?: unknown; answer?: unknown }[] };
      const answers = (input.answers ?? []).filter((entry) => typeof entry.id === "string" && typeof entry.answer === "string" && entry.answer.trim());
      if (!answers.length) return json({ error: "Keine Antworten." }, 400);
      await env.DB.batch(
        answers.map((entry) =>
          env.DB.prepare("UPDATE owner_questions SET answer = ?, answered_at = unixepoch() WHERE tenant_id = ? AND id = ? AND initiative_id = ?")
            .bind(String(entry.answer).trim().slice(0, 4_000), caller.tenantId, entry.id, initiativeId),
        ),
      );
      const open = await env.DB.prepare("SELECT COUNT(*) AS n FROM owner_questions WHERE tenant_id = ? AND initiative_id = ? AND answer IS NULL").bind(caller.tenantId, initiativeId).first<{ n: number }>();
      // All answered: the step that asked runs again with the answers in its prompt.
      if (!open?.n) await retryWorkflow(env, caller, initiativeId, "Ugur hat deine Rückfragen beantwortet (siehe „Ugurs Antworten“). Arbeite den Schritt damit vollständig aus.").catch((error) => {
        if (!(error instanceof WorkflowError)) throw error;
      });
      return json({ ok: true, open: open?.n ?? 0 });
    }
    if (match[2] === "approve") return json(await approvePlanning(env, caller, initiativeId));
    await cancelWorkflow(env, caller, initiativeId);
    return json({ ok: true });
  } catch (error) {
    if (error instanceof WorkflowError) return json({ error: error.message }, error.status);
    throw error;
  }
}
