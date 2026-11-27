import { describe, expect, it } from "vitest";
import { AGENTS } from "../apps/api/src/agents/registry.ts";
import { SubrequestBudget } from "../apps/api/src/runtime/budget.ts";
import type { ToolContext } from "../apps/api/src/tools/port.ts";
import { toolByName } from "../apps/api/src/tools/registry.ts";
import { byColumn, countByStatus, projectSummaries, tasksInScope } from "../apps/office/src/features/agents/ui/board/board.ts";
import { MOVES } from "../apps/office/src/features/agents/ui/board/transitions.ts";
import { TRANSITIONS } from "../apps/api/src/work/tasks.ts";
import type { OfficeTask, ThreadProject } from "../apps/office/src/features/agents/types.ts";
import { apiHarness } from "./_helpers/api-env.ts";

/** The office board (plan stage 5) and the first wave of the delivery team (plan stage 4). */
const now = Date.UTC(2026, 10, 27);
const seconds = (daysAgo: number) => Math.floor((now - daysAgo * 86_400_000) / 1000);
const task = (id: string, projectId: string | null, status: OfficeTask["status"], extra: Partial<OfficeTask> = {}): OfficeTask => ({
  id, projectId, title: id, status, priority: "normal", storyPoints: null, threadId: null, updatedAt: seconds(1), agent: null,
  description: null, acceptanceCriteria: null, completionNote: null, latestReview: null, ...extra,
});
const project = (id: string): ThreadProject => ({ id, name: id.toUpperCase(), repo: `o/${id}`, visibility: "public" });

describe("office board", () => {
  const tasks = [
    task("a", "web", "backlog"),
    task("b", "web", "in_progress", { priority: "urgent" }),
    task("c", "api", "blocked"),
    task("d", "api", "done", { updatedAt: seconds(30) }),
    task("e", "api", "done"),
    task("f", null, "ready"),
  ];

  it("shows a project's work, or all of it on the company level, and drops old done items", () => {
    expect(tasksInScope(tasks, "web", now).map((entry) => entry.id)).toEqual(["a", "b"]);
    expect(tasksInScope(tasks, null, now).map((entry) => entry.id)).toEqual(["a", "b", "c", "e", "f"]);
  });

  it("counts every status and sorts each column by priority", () => {
    const scoped = tasksInScope(tasks, null, now);
    expect(countByStatus(scoped)).toEqual({ backlog: 1, ready: 1, in_progress: 1, review: 0, qa: 0, blocked: 1, done: 1 });
    const columns = byColumn([task("x", "web", "ready"), task("y", "web", "ready", { priority: "high" })]);
    expect(columns.ready.map((entry) => entry.id)).toEqual(["y", "x"]);
  });

  it("offers exactly the moves the API allows; done goes through the acceptance form", () => {
    for (const [status, allowed] of Object.entries(TRANSITIONS)) {
      const offered = MOVES[status as OfficeTask["status"]].map((move) => move.to).sort();
      expect(offered, status).toEqual(allowed.filter((next) => next !== "done").sort());
    }
  });

  it("classifies the company view by project, most open work first, without empty projects", () => {
    const summaries = projectSummaries(tasksInScope(tasks, null, now), [project("web"), project("api"), project("empty")]);
    expect(summaries.map((summary) => [summary.project.id, summary.open])).toEqual([["web", 2], ["api", 1]]);
  });
});

function contextFor(env: ToolContext["env"], projectId: string, agentId = "product-owner"): ToolContext {
  return { env, tenantId: "owner", agentId, threadId: "t-1", projectId, repo: projectId ? "devUgur/uguroezdamar.com" : "", budget: new SubrequestBudget() };
}

describe("board tools", () => {
  it("lets the Product Owner file a backlog task in the conversation's project, only there", async () => {
    const { env, db } = apiHarness();
    const tool = toolByName("task_create")!;
    expect(tool.requiresProject).toBe(true);
    expect(tool.requiresApproval).toBeFalsy();
    const created = (await tool.run({ title: "Footer verlinken", acceptanceCriteria: "Link führt zu /impressum", priority: "high", projectId: "fremd" }, contextFor(env, "uguroezdamar"))) as { id: string; status: string; projectId: string };
    expect(created).toMatchObject({ status: "backlog", projectId: "uguroezdamar" });
    const row = await db.prepare("SELECT created_by, agent_id, acceptance_criteria FROM tasks WHERE id = ?").bind(created.id).first();
    expect(row).toEqual({ created_by: "agent:product-owner", agent_id: null, acceptance_criteria: "Link führt zu /impressum" });
    await expect(tool.run({ title: "", acceptanceCriteria: "x" }, contextFor(env, "uguroezdamar"))).rejects.toThrow(/title/);
  });

  it("lists open work by status, per project or for the whole company", async () => {
    const { env } = apiHarness();
    const create = toolByName("task_create")!;
    await create.run({ title: "Eins", acceptanceCriteria: "a" }, contextFor(env, "uguroezdamar"));
    const list = toolByName("tasks_list")!;
    const scoped = (await list.run({}, contextFor(env, "uguroezdamar"))) as { scope: string; byStatus: Record<string, number>; tasks: unknown[] };
    expect(scoped).toMatchObject({ scope: "uguroezdamar", byStatus: { backlog: 1 } });
    const company = (await list.run({}, contextFor(env, ""))) as { scope: string; tasks: unknown[] };
    expect(company.scope).toBe("firma");
    expect(company.tasks.length).toBeGreaterThanOrEqual(1);
    await expect(list.run({ status: "irgendwas" }, contextFor(env, ""))).rejects.toThrow(/Status/);
  });
});

describe("delivery team", () => {
  const team = ["chef", "product-owner", "tech-lead", "developer", "reviewer", "devops"];

  it("has every role in the registry, with tools that exist", () => {
    expect(Object.keys(AGENTS).sort()).toEqual([...team].sort());
    for (const agent of Object.values(AGENTS)) {
      for (const name of agent.tools) expect(toolByName(name), `${agent.id}: ${name}`).toBeDefined();
    }
  });

  it("keeps writing with the developer and the chef; planners and DevOps cannot commit", () => {
    const writes = (id: string) => AGENTS[id]!.tools.includes("repo_commit_files");
    expect(team.filter(writes).sort()).toEqual(["chef", "developer"]);
  });

  it("seats every agent at its own desk with a definition in the catalog", async () => {
    const { db } = apiHarness();
    const { results } = await db.prepare("SELECT id, desk_x, desk_y, definition_id FROM agents WHERE active = 1 ORDER BY id").all<{ id: string; desk_x: number; desk_y: number; definition_id: string | null }>();
    expect(results.map((row) => row.id).sort()).toEqual([...team].sort());
    expect(new Set(results.map((row) => `${row.desk_x}:${row.desk_y}`)).size).toBe(results.length);
    expect(results.every((row) => row.definition_id)).toBe(true);
  });

  it("states the scope and the shared rules in every new role's prompt", () => {
    for (const id of ["product-owner", "tech-lead", "developer", "devops"]) {
      const inProject = AGENTS[id]!.systemPrompt({ repo: "devUgur/x", projectName: "x", memories: [] });
      const company = AGENTS[id]!.systemPrompt({ repo: "", projectName: "", memories: ["Merke"] });
      expect(inProject).toContain("Repository devUgur/x");
      expect(company).toContain("Firmenebene");
      expect(company).toContain("- Merke");
      expect(inProject).toContain("du mergst und deployst nie");
    }
  });
});
