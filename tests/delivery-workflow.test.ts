import { describe, expect, it } from "vitest";
import type { Env } from "../apps/api/src/env.ts";
import { stepFinished } from "../apps/api/src/workflow/engine.ts";
import { apiHarness } from "./_helpers/api-env.ts";

/**
 * Phase P3 of ADR 0040: a task goes through the team. Agent runs are stubbed; the engine, the SQL and the routes are
 * real. A run "ends" here by calling stepFinished, as the runtime does when the agent's run is over.
 */
function setup() {
  const chats: { name: string; agentId: string; text: string }[] = [];
  const agents = {
    get: (name: string) => ({
      chat: async (input: { agentId: string; text: string }) => {
        chats.push({ name, agentId: input.agentId, text: input.text });
        return { accepted: true };
      },
      stop: async () => undefined,
    }),
  };
  const harness = apiHarness({ AGENTS: agents });
  const owner = { "x-portal-scopes": "organization:write" };
  return { ...harness, chats, owner };
}

async function readyTask(request: ReturnType<typeof setup>["request"]) {
  const created = (await request("/api/tasks", { method: "POST", body: { title: "Footer verlinken", description: "Impressum fehlt", projectId: "uguroezdamar" } })).body as { id: string };
  await request(`/api/tasks/${created.id}`, { method: "PATCH", body: { status: "ready" } });
  return created.id;
}

async function openStep(db: ReturnType<typeof setup>["db"]) {
  return db.prepare("SELECT step, agent_id, thread_id, attempt FROM workflow_steps WHERE status IN ('running', 'waiting_approval') ORDER BY started_at DESC, rowid DESC").first<{ step: string; agent_id: string; thread_id: string; attempt: number }>();
}

/** The run of a step ends, as the runtime reports it. */
const finish = (threadId: string, output = "Erledigt.\nÜbergabe:\n- Punkt") => (env: Env) =>
  stepFinished(env, { tenantId: "owner", threadId, outcome: "done", output });

describe("delivery workflow", () => {
  it("runs a task through the team, waits for approvals, reworks after QA and ends with Ugur's acceptance", async () => {
    const { request, env, db, chats } = setup();
    const taskId = await readyTask(request);

    const started = await request(`/api/tasks/${taskId}/delivery`, { method: "POST" });
    expect(started.status).toBe(202);
    expect(await openStep(db)).toMatchObject({ step: "intake", agent_id: "chef" });
    expect((await db.prepare("SELECT status FROM tasks WHERE id = ?").bind(taskId).first())?.status).toBe("in_progress");
    expect((await request(`/api/tasks/${taskId}/delivery`, { method: "POST" })).status).toBe(409);

    // intake → requirements → plan → implement, each with the handoffs of the steps before
    for (const [done, next] of [["intake", "product-owner"], ["requirements", "tech-lead"], ["plan", "developer"]] as const) {
      const step = await openStep(db);
      expect(step?.step).toBe(done);
      await finish(step!.thread_id, `Ergebnis ${done}.\nÜbergabe:\n- ${done} fertig`)(env);
      expect((await openStep(db))?.agent_id).toBe(next);
    }
    expect(chats.at(-1)?.text).toContain("Übergaben der vorigen Schritte");
    expect(chats.at(-1)?.text).toContain("- plan fertig");
    expect((await db.prepare("SELECT agent_id FROM tasks WHERE id = ?").bind(taskId).first())?.agent_id).toBe("developer");

    // the developer proposed a pull request: the step waits for Ugur's decision
    const implement = await openStep(db);
    await db.prepare("INSERT INTO approvals (id, tenant_id, agent_id, thread_id, action, details, status) VALUES ('ap-1', 'owner', 'developer', ?, 'repo_open_pull_request', '{}', 'pending')").bind(implement!.thread_id).run();
    await finish(implement!.thread_id)(env);
    expect(await openStep(db)).toMatchObject({ step: "implement" });
    expect((await db.prepare("SELECT status FROM workflow_steps WHERE thread_id = ?").bind(implement!.thread_id).first())?.status).toBe("waiting_approval");
    await db.prepare("UPDATE approvals SET status = 'approved' WHERE id = 'ap-1'").run();
    await finish(implement!.thread_id, "PR #12 offen.\nÜbergabe:\n- PR #12")(env);

    // QA starts through the existing independent review and asks for rework once
    const qa = await openStep(db);
    expect(qa).toMatchObject({ step: "qa", agent_id: "reviewer" });
    expect((await db.prepare("SELECT status FROM tasks WHERE id = ?").bind(taskId).first())?.status).toBe("qa");
    await db.prepare("UPDATE task_reviews SET status = 'completed', verdict = 'changes_requested', summary = 'Link fehlt im Footer' WHERE thread_id = ?").bind(qa!.thread_id).run();
    await db.prepare("UPDATE tasks SET status = 'in_progress' WHERE id = ?").bind(taskId).run();
    await finish(qa!.thread_id)(env);
    const rework = await openStep(db);
    expect(rework).toMatchObject({ step: "implement", attempt: 2 });
    expect(chats.at(-1)?.text).toContain("QA hat Nacharbeit verlangt");
    expect(chats.at(-1)?.text).toContain("Link fehlt im Footer");

    // second round passes, the chef reports, Ugur accepts
    await finish(rework!.thread_id)(env);
    const qa2 = await openStep(db);
    await db.prepare("UPDATE task_reviews SET status = 'completed', verdict = 'pass', summary = 'ok' WHERE thread_id = ?").bind(qa2!.thread_id).run();
    await finish(qa2!.thread_id)(env);
    const report = await openStep(db);
    expect(report).toMatchObject({ step: "report", agent_id: "chef" });
    await finish(report!.thread_id)(env);
    const deliveries = (await request("/api/deliveries")).body as { taskId: string; status: string; rework: number; steps: { step: string }[] }[];
    expect(deliveries[0]).toMatchObject({ taskId, status: "awaiting_acceptance", rework: 1 });
    expect(deliveries[0]?.steps.map((step) => step.step)).toEqual(["intake", "requirements", "plan", "implement", "qa", "implement", "qa", "report"]);

    const accepted = await request(`/api/tasks/${taskId}`, { method: "PATCH", body: { status: "done", completionNote: "Footer-Link geprüft und abgenommen." } });
    expect(accepted.status).toBe(200);
    expect((await db.prepare("SELECT status FROM workflow_runs WHERE task_id = ?").bind(taskId).first())?.status).toBe("done");
  });

  it("hands a failed step to Ugur, lets him retry it, and can be cancelled", async () => {
    const { request, env, db } = setup();
    const taskId = await readyTask(request);
    await request(`/api/tasks/${taskId}/delivery`, { method: "POST" });
    const intake = await openStep(db);
    await stepFinished(env, { tenantId: "owner", threadId: intake!.thread_id, outcome: "failed", output: "Modell nicht erreichbar" });
    expect(await db.prepare("SELECT status, note FROM workflow_runs WHERE task_id = ?").bind(taskId).first()).toMatchObject({ status: "waiting_owner" });
    expect((await db.prepare("SELECT status FROM tasks WHERE id = ?").bind(taskId).first())?.status).toBe("blocked");

    expect((await request(`/api/tasks/${taskId}/delivery/retry`, { method: "POST" })).status).toBe(200);
    expect(await openStep(db)).toMatchObject({ step: "intake", attempt: 2 });
    expect((await db.prepare("SELECT status FROM tasks WHERE id = ?").bind(taskId).first())?.status).toBe("in_progress");

    const retried = await openStep(db);
    await db.prepare("INSERT INTO approvals (id, tenant_id, agent_id, thread_id, action, details, status) VALUES ('ap-2', 'owner', 'chef', ?, 'repo_commit_files', '{}', 'pending')").bind(retried!.thread_id).run();
    expect((await request(`/api/tasks/${taskId}/delivery/cancel`, { method: "POST" })).status).toBe(200);
    // the open proposal of the cancelled workflow is withdrawn with it
    expect((await db.prepare("SELECT status FROM approvals WHERE id = 'ap-2'").first())?.status).toBe("rejected");
    expect(await openStep(db)).toBeNull();
    expect((await db.prepare("SELECT status FROM workflow_runs WHERE task_id = ?").bind(taskId).first())?.status).toBe("cancelled");
    // a run that ends after the cancel changes nothing
    expect(await stepFinished(env, { tenantId: "owner", threadId: "unbekannt", outcome: "done", output: "" })).toBe(false);
  });

  it("only takes tasks that are ready", async () => {
    const { request } = setup();
    const created = (await request("/api/tasks", { method: "POST", body: { title: "Noch im Backlog", projectId: "uguroezdamar" } })).body as { id: string };
    expect((await request(`/api/tasks/${created.id}/delivery`, { method: "POST" })).status).toBe(409);
  });
});
