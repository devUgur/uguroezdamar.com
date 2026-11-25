import { describe, expect, it } from "vitest";
import { describeApproval } from "../apps/platform/src/approvals.ts";
import type { ChatMessage } from "../apps/platform/src/models/port.ts";
import { SubrequestBudget } from "../apps/platform/src/runtime/budget.ts";
import { type LoopDeps, type LoopEvent, type ModelTurn, runAgentLoop } from "../apps/platform/src/runtime/loop.ts";
import type { Tool, ToolContext } from "../apps/platform/src/tools/port.ts";

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
  const commit: Tool = { ...readFile, requiresApproval: true, spec: { ...readFile.spec, name: "repo_commit_files" } };
  let call = 0;
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
    requestApproval: async (tool, args) => ({ approvalId: "a-1", description: describeApproval(tool, args) }),
    emit: async (event) => void events.push(event),
    delta: (_step, text) => void deltas.push(text),
    stepsDone: 0,
    maxSteps: 24,
    ...overrides,
  };
  return { deps, messages, events, deltas, budget };
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

  it("pauses before the subrequest budget runs out instead of failing", async () => {
    const { deps, budget } = harness([toolTurn("repo_read_file", { path: "a" }), answer("fertig")]);
    budget.take(36); // 4 left: below what a step needs
    expect(await runAgentLoop(deps)).toEqual({ kind: "paused", steps: 0 });
  });

  it("continues a run from the steps of earlier stages and stops at the step limit", async () => {
    const { deps } = harness([toolTurn("repo_read_file", { path: "a" })], { stepsDone: 23, maxSteps: 24 });
    expect(await runAgentLoop(deps)).toMatchObject({ kind: "step_limit", steps: 24 });
  });
});
