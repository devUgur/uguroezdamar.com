import { describe, expect, it } from "vitest";
import type { Env } from "../apps/api/src/env.ts";
import { SubrequestBudget } from "../apps/api/src/runtime/budget.ts";
import type { ToolContext } from "../apps/api/src/tools/port.ts";
import { toolByName } from "../apps/api/src/tools/registry.ts";
import { continueSprint, stepFinished } from "../apps/api/src/workflow/engine.ts";
import { apiHarness } from "./_helpers/api-env.ts";

/**
 * ADR 0041: Ugur describes a wish; the team asks, designs, reviews, builds the backlog and proposes a sprint; after
 * his approval the sprint starts with the first ticket whose dependencies are met. Agent runs are stubbed, the
 * workflow engine, the tools and SQL are real.
 */
function setup() {
  const chats: { agentId: string; text: string }[] = [];
  const agents = {
    get: () => ({
      chat: async (input: { agentId: string; text: string }) => {
        chats.push({ agentId: input.agentId, text: input.text });
        return { accepted: true };
      },
      stop: async () => undefined,
    }),
  };
  return { ...apiHarness({ AGENTS: agents }), chats };
}

type Db = ReturnType<typeof setup>["db"];
const open = (db: Db) =>
  db.prepare("SELECT step, agent_id, thread_id, attempt FROM workflow_steps WHERE status IN ('running', 'waiting_approval') ORDER BY started_at DESC, rowid DESC")
    .first<{ step: string; agent_id: string; thread_id: string; attempt: number }>();
const done = (env: Env, threadId: string, output: string) => stepFinished(env, { tenantId: "owner", threadId, outcome: "done", output });
const context = (env: Env, agentId: string, taskId: string): ToolContext => ({
  env, tenantId: "owner", agentId, threadId: "t", projectId: "uguroezdamar", repo: "devUgur/uguroezdamar.com", taskId, budget: new SubrequestBudget(),
});

describe("planning an initiative", () => {
  it("goes from a wish to an approved sprint, asking Ugur and reworking the architecture on the way", async () => {
    const { request, env, db, chats } = setup();
    const created = await request("/api/initiatives", { method: "POST", body: { projectId: "uguroezdamar", title: "Kundenportal", brief: "Kunden sollen sich anmelden und ihre Projekte und Rechnungen sehen können." } });
    expect(created.status).toBe(202);
    const initiativeId = (created.body as { initiativeId: string }).initiativeId;
    expect(await db.prepare("SELECT kind, status FROM tasks WHERE id = ?").bind(initiativeId).first()).toEqual({ kind: "initiative", status: "backlog" });
    expect(await open(db)).toMatchObject({ step: "intake", agent_id: "chef" });

    // the chef asks; the workflow waits for Ugur and runs the intake again with his answer
    await toolByName("ask_owner")!.run({ questions: [{ question: "Rechnungen als PDF?", why: "bestimmt den Umfang", proposal: "ja" }] }, context(env, "chef", initiativeId));
    await done(env, (await open(db))!.thread_id, "Ziel: Kundenportal.\nÜbergabe:\n- Frage offen");
    expect(await db.prepare("SELECT status FROM workflow_runs WHERE task_id = ?").bind(initiativeId).first()).toEqual({ status: "waiting_owner" });
    const [question] = ((await request("/api/initiatives")).body as { questions: { id: string }[] }[])[0]!.questions;
    expect((await request(`/api/initiatives/${initiativeId}/answers`, { method: "POST", body: { answers: [{ id: question!.id, answer: "Ja, als PDF zum Download" }] } })).body).toMatchObject({ open: 0 });
    expect(await open(db)).toMatchObject({ step: "intake", attempt: 2 });
    expect(chats.at(-1)?.text).toContain("Ja, als PDF zum Download");

    await done(env, (await open(db))!.thread_id, "Ziel, Umfang, Annahmen.\nÜbergabe:\n- klar");
    await done(env, (await open(db))!.thread_id, "Anforderungen: Login, Projekte, Rechnungen.\nÜbergabe:\n- fertig");
    expect(await open(db)).toMatchObject({ step: "architecture", agent_id: "tech-lead" });
    expect(chats.at(-1)?.text).toContain("Anforderungen: Login, Projekte, Rechnungen.");
    await done(env, (await open(db))!.thread_id, "Architektur v1.\nÜbergabe:\n- v1");

    // the review sends the architecture back once, then passes
    await done(env, (await open(db))!.thread_id, '{"verdict":"changes_requested","summary":"Mandantentrennung fehlt","findings":["tenant_id in jeder Tabelle"]}');
    expect(await open(db)).toMatchObject({ step: "architecture", attempt: 2 });
    expect(chats.at(-1)?.text).toContain("Mandantentrennung fehlt");
    await done(env, (await open(db))!.thread_id, "Architektur v2 mit Mandanten.\nÜbergabe:\n- v2");
    await done(env, (await open(db))!.thread_id, '{"verdict":"pass","summary":"umsetzbar"}');
    expect(await open(db)).toMatchObject({ step: "backlog", agent_id: "scrum-master" });

    // the Scrum Master builds the backlog: an epic below the initiative, two stories, the second depends on the first
    const create = toolByName("task_create")!;
    const scrum = context(env, "scrum-master", initiativeId);
    const epic = (await create.run({ kind: "epic", title: "Anmeldung", acceptanceCriteria: "Kunden können sich anmelden" }, scrum)) as { id: string; parentId: string };
    expect(epic.parentId).toBe(initiativeId);
    const login = (await create.run({ kind: "story", parentId: epic.id, title: "Login-Seite", acceptanceCriteria: "Login mit E-Mail", role: "developer", storyPoints: 3 }, scrum)) as { id: string };
    const reset = (await create.run({ kind: "story", parentId: epic.id, title: "Passwort zurücksetzen", acceptanceCriteria: "Mail mit Link", role: "developer", dependsOn: [login.id] }, scrum)) as { id: string };
    await expect(create.run({ kind: "epic", parentId: login.id, title: "falsch", acceptanceCriteria: "x" }, scrum)).rejects.toThrow(/Epic hängt an einem Vorhaben/);
    await done(env, (await open(db))!.thread_id, "Backlog angelegt.\nÜbergabe:\n- 1 Epic, 2 Stories");

    await expect(toolByName("sprint_propose")!.run({ name: "S1", goal: "Anmelden", taskIds: [epic.id] }, scrum)).rejects.toThrow(/Nicht im Backlog/);
    await toolByName("sprint_propose")!.run({ name: "Sprint 1", goal: "Kunden können sich anmelden", taskIds: [login.id, reset.id] }, scrum);
    await done(env, (await open(db))!.thread_id, "Sprint vorgeschlagen.\nÜbergabe:\n- Sprint 1");
    await done(env, (await open(db))!.thread_id, "Gesamtkonzept für Ugur.\nÜbergabe:\n- bitte freigeben");

    const [initiative] = (await request("/api/initiatives?project=uguroezdamar")).body as { planning: { status: string }; artifacts: { kind: string; version: number }[]; backlog: Record<string, number> }[];
    expect(initiative!.planning.status).toBe("awaiting_acceptance");
    expect(initiative!.artifacts.map((artifact) => `${artifact.kind}:${artifact.version}`)).toEqual(["intake:2", "discovery:1", "architecture:2", "review:2", "backlog:1", "sprint:1", "summary:1"]);
    expect(initiative!.backlog).toEqual({ epic: 1, story: 2 });

    // Ugur approves: the sprint is active, its stories ready, and the team starts the one without open dependencies
    const approved = (await request(`/api/initiatives/${initiativeId}/approve`, { method: "POST" })).body as { sprintId: string; started: string };
    expect(approved.started).toBe(login.id);
    expect(await db.prepare("SELECT status FROM sprints WHERE id = ?").bind(approved.sprintId).first()).toEqual({ status: "active" });
    expect(await db.prepare("SELECT status FROM tasks WHERE id = ?").bind(reset.id).first()).toEqual({ status: "ready" });
    expect(await open(db)).toMatchObject({ step: "intake", agent_id: "chef" });

    // one ticket at a time: while login is in the team's hands nothing else starts; once it awaits acceptance, reset follows
    expect(await continueSprint(env, "owner", approved.sprintId)).toBeNull();
    await db.prepare("UPDATE workflow_runs SET status = 'awaiting_acceptance' WHERE task_id = ?").bind(login.id).run();
    await db.prepare("UPDATE tasks SET status = 'qa' WHERE id = ?").bind(login.id).run();
    expect(await continueSprint(env, "owner", approved.sprintId)).toBe(reset.id);
  });

  it("refuses a wish without substance and a plan that is not ready", async () => {
    const { request } = setup();
    expect((await request("/api/initiatives", { method: "POST", body: { projectId: "uguroezdamar", title: "x", brief: "kurz" } })).status).toBe(400);
    const created = (await request("/api/initiatives", { method: "POST", body: { projectId: "uguroezdamar", title: "Blog", brief: "Ein Blog mit Kategorien und RSS-Feed für die Website." } })).body as { initiativeId: string };
    expect((await request(`/api/initiatives/${created.initiativeId}/approve`, { method: "POST" })).status).toBe(409);
    expect((await request(`/api/initiatives/${created.initiativeId}/cancel`, { method: "POST" })).status).toBe(200);
  });
});
