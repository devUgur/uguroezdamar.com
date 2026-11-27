import { describe, expect, it } from "vitest";
import { describeApproval } from "../apps/api/src/approvals.ts";
import type { ChatMessage } from "../apps/api/src/models/port.ts";
import { SubrequestBudget } from "../apps/api/src/runtime/budget.ts";
import { announcesUndoneWork, type LoopDeps, type LoopEvent, type ModelTurn, runAgentLoop } from "../apps/api/src/runtime/loop.ts";
import type { Tool, ToolContext } from "../apps/api/src/tools/port.ts";
import { decide } from "../apps/api/src/policy/engine.ts";
import type { AutonomyLevel } from "../apps/api/src/policy/catalog.ts";

/** Smoke test of the agent core: user → tool call → result → answer, with every step as an event. */
function harness(turns: ModelTurn[], overrides: Partial<LoopDeps> = {}) {
  const messages: ChatMessage[] = [{ role: "user", content: "Lies AGENTS.md" }];
  const events: LoopEvent[] = [];
  const deltas: string[] = [];
  const budget = new SubrequestBudget(40);
  const readFile: Tool = {
    spec: { name: "repo_read_file", description: "liest", parameters: { type: "object", properties: {} } },
    async run(args, context) {
      context.budget.take();
      return { path: args.path, content: "# Arbeitsregeln" };
    },
  };
  const commit: Tool = { ...readFile, requiresApproval: true, requiresProject: true, spec: { ...readFile.spec, name: "repo_commit_files" } };
  let call = 0;
  const level: { current: AutonomyLevel } = { current: "manual" };
  const deps: LoopDeps = {
    system: { role: "system", content: "Du bist der Chef-Agent." },
    history: { recent: () => [...messages], append: (message) => messages.push(message) },
    async model(_request, onDelta) {
      budget.take();
      const turn = turns[call++];
      if (!turn) throw new Error("no more turns");
      if (turn.message.content) onDelta(turn.message.content);
      return turn;
    },
    tools: [readFile, commit],
    context: { agentId: "chef", projectId: "p", repo: "o/r", budget } as unknown as ToolContext,
    budget,
    // The real policy engine at the level the test chooses (default manual: every write waits for Ugur).
    policy: async (tool, args) =>
      decide({ tool: tool.spec.name, args, writes: Boolean(tool.requiresApproval), needsProject: Boolean(tool.requiresProject), repo: deps.context.repo, level: level.current }),
    requestApproval: async (tool, args) => ({ approvalId: "a-1", description: describeApproval(tool, args) }),
    emit: async (event) => void events.push(event),
    delta: (_step, text) => void deltas.push(text),
    stepsDone: 0,
    maxSteps: 24,
    ...overrides,
  };
  return { deps, messages, events, deltas, budget, level };
}

const usage = { inputTokens: 10, outputTokens: 5 };
const toolTurn = (name: string, args: object): ModelTurn => ({
  message: { role: "assistant", content: null, toolCalls: [{ id: "c1", name, arguments: JSON.stringify(args) }] },
  usage,
  costUsd: 0,
  model: "fake/model",
  attempts: ["fake/model: ok"],
});
const answer = (text: string): ModelTurn => ({ message: { role: "assistant", content: text }, usage, costUsd: 0, model: "fake/model", attempts: [] });

describe("platform agent loop", () => {
  it("runs user → tool → result → answer and logs each step", async () => {
    const { deps, messages, events, deltas } = harness([toolTurn("repo_read_file", { path: "AGENTS.md" }), answer("Die Regeln sind …")]);
    const outcome = await runAgentLoop(deps);

    expect(outcome).toEqual({ kind: "done", reply: "Die Regeln sind …", steps: 2 });
    expect(events.map((event) => event.type)).toEqual([
      "thinking", "model_result", "tool_call", "tool_result", "thinking", "model_result", "message",
    ]);
    expect(messages.map((message) => message.role)).toEqual(["user", "assistant", "tool", "assistant"]);
    expect(messages[2]?.content).toContain("# Arbeitsregeln");
    expect(deltas.join("")).toBe("Die Regeln sind …");
  });

  it("only proposes actions with outside effect and marks protected paths", async () => {
    const files = [{ path: ".github/workflows/ci.yml", content: "x" }];
    const { deps, events } = harness([toolTurn("repo_commit_files", { branch: "dev", message: "m", files }), answer("Wartet auf Freigabe.")]);
    await runAgentLoop(deps);

    const requested = events.find((event) => event.type === "approval_requested");
    expect(requested?.data).toMatchObject({ approvalId: "a-1", risk: "security" });
    expect(events.some((event) => event.type === "tool_result")).toBe(false);
  });

  it("commits on an agent branch without asking when the project allows it, and says so", async () => {
    const files = [{ path: "src/a.ts", content: "x" }];
    const { deps, events, level } = harness([toolTurn("repo_commit_files", { branch: "agent/x", message: "m", files }), answer("Committet.")]);
    level.current = "balanced";
    await runAgentLoop(deps);

    expect(events.some((event) => event.type === "approval_requested")).toBe(false);
    expect(events.find((event) => event.type === "policy_allowed")?.data).toMatchObject({ tool: "repo_commit_files", policy: { class: "branch", level: "balanced" } });
    expect(events.find((event) => event.type === "tool_result")?.data).toMatchObject({ ok: true });
  });

  it("still asks for a workflow file at the highest autonomy", async () => {
    const files = [{ path: ".github/workflows/ci.yml", content: "x" }];
    const { deps, events, level } = harness([toolTurn("repo_commit_files", { branch: "agent/x", message: "m", files }), answer("Wartet.")]);
    level.current = "max";
    await runAgentLoop(deps);
    expect(events.find((event) => event.type === "approval_requested")?.data).toMatchObject({ policy: { class: "pipeline", level: "max" } });
  });

  it("refuses writing on the company level before asking for an approval", async () => {
    const files = [{ path: "README.md", content: "x" }];
    const { deps, events, messages } = harness([toolTurn("repo_commit_files", { branch: "agent/x", message: "m", files }), answer("Geht nur im Projekt.")]);
    deps.context = { ...deps.context, projectId: "", repo: "" };
    await runAgentLoop(deps);

    expect(events.some((event) => event.type === "approval_requested")).toBe(false);
    expect(events.find((event) => event.type === "tool_result")?.data).toMatchObject({ tool: "repo_commit_files", ok: false });
    expect(messages.find((message) => message.role === "tool")?.content).toContain("Firmenebene");
  });

  it("pauses before the subrequest budget runs out instead of failing", async () => {
    const { deps, budget } = harness([toolTurn("repo_read_file", { path: "a" }), answer("fertig")]);
    budget.take(36); // 4 left: below what a step needs
    expect(await runAgentLoop(deps)).toEqual({ kind: "paused", steps: 0 });
  });

  it("continues a run from the steps of earlier stages and stops at the step limit", async () => {
    const { deps } = harness([toolTurn("repo_read_file", { path: "a" })], { stepsDone: 23, maxSteps: 24 });
    expect(await runAgentLoop(deps)).toMatchObject({ kind: "step_limit", steps: 24 });
  });

  it("sends a reminder when a turn only announces work, without storing it as a chat message", async () => {
    const requests: ChatMessage[][] = [];
    const { deps, messages, events } = harness([
      answer("Die README hilft nicht. Ich werde den Inhalt von AGENTS.md lesen."),
      toolTurn("repo_read_file", { path: "AGENTS.md" }),
      answer("Die Regeln sind …"),
    ]);
    const model = deps.model;
    deps.model = async (request, onDelta) => {
      requests.push(request.messages);
      return model(request, onDelta);
    };
    const outcome = await runAgentLoop(deps);

    expect(outcome).toMatchObject({ kind: "done", reply: "Die Regeln sind …" });
    expect(requests[1]?.at(-1)?.content).toContain("kein Werkzeug aufgerufen");
    expect(requests[2]?.some((message) => message.content?.includes("kein Werkzeug aufgerufen"))).toBe(false);
    expect(messages.some((message) => message.role === "user" && message.content?.includes("kein Werkzeug aufgerufen"))).toBe(false);
    expect(events.filter((event) => event.type === "message")).toHaveLength(1);
  });

  it("reminds at most twice, then accepts the answer", async () => {
    const { deps } = harness([answer("Ich werde lesen."), answer("Ich werde lesen."), answer("Ich werde lesen."), answer("zu viel")]);
    expect(await runAgentLoop(deps)).toMatchObject({ kind: "done", reply: "Ich werde lesen.", steps: 3 });
  });

  it("does not mistake questions or finished answers for announcements", () => {
    expect(announcesUndoneWork("Soll ich die Datei lesen?")).toBe(false);
    expect(announcesUndoneWork("Das Repository enthält apps und packages. Es ist ein Monorepo.")).toBe(false);
    expect(announcesUndoneWork("Die README ist leer. Ich werde nun AGENTS.md lesen.")).toBe(true);
  });
});
