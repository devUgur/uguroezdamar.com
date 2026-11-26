import type { ApprovalDescription } from "../approvals.ts";
import type { EventType } from "../events.ts";
import type { ChatMessage, ToolCall, ToolSpec, Usage } from "../models/port.ts";
import type { Tool, ToolContext } from "../tools/port.ts";
import { BudgetExhausted, type SubrequestBudget } from "./budget.ts";

/**
 * The think → tool → answer loop, free of Cloudflare APIs so it can be tested with fakes.
 * One call runs one stage: it stops before the subrequest budget runs out and reports how
 * many steps it took, and the runtime schedules the next stage.
 */
export const TOOL_RESULT_CHARS = 20_000;
const PREVIEW_CHARS = 600;
/** External calls a step may need before it starts: the model plus fallbacks, plus a read. */
const STEP_RESERVE = 6;
/** External calls a single tool may need (a commit takes up to six GitHub requests). */
const TOOL_RESERVE = 6;

export interface ModelTurn {
  message: ChatMessage;
  usage: Usage;
  costUsd: number;
  /** provider/model that answered. */
  model: string;
  attempts: string[];
}

export interface LoopEvent {
  type: EventType;
  data?: unknown;
  tokensIn?: number;
  tokensOut?: number;
  costUsd?: number;
}

export interface LoopDeps {
  system: ChatMessage;
  history: { recent(): ChatMessage[]; append(message: ChatMessage): void };
  model(request: { messages: ChatMessage[]; tools: ToolSpec[] }, onDelta: (text: string) => void): Promise<ModelTurn>;
  /** Tools this agent may use. */
  tools: Tool[];
  context: ToolContext;
  budget: SubrequestBudget;
  requestApproval(tool: string, args: Record<string, unknown>): Promise<{ approvalId: string; description: ApprovalDescription }>;
  emit(event: LoopEvent): Promise<void>;
  /** Live-only text of the answer being written; not stored. */
  delta(step: number, text: string): void;
  /** Steps already taken in earlier stages of this run. */
  stepsDone: number;
  maxSteps: number;
}

export type LoopOutcome =
  | { kind: "done"; reply: string; steps: number }
  | { kind: "paused"; steps: number }
  | { kind: "step_limit"; reply: string; steps: number }
  | { kind: "failed"; reply: string; steps: number };

/** Smaller models sometimes end a turn with "Ich werde jetzt X lesen." and no tool call. */
const ANNOUNCEMENT = /\b(ich werde|ich lese|ich öffne|ich prüfe|ich schaue|ich sehe mir|ich suche|ich liste|ich rufe|lass mich|als nächstes|im nächsten schritt|zunächst werde)\b/i;
const MAX_NUDGES = 2;
const NUDGE: ChatMessage = {
  role: "user",
  content:
    "Du hast eine Aktion angekündigt, aber kein Werkzeug aufgerufen. Führe sie jetzt mit dem passenden Werkzeug aus. Ist nichts mehr zu tun, antworte abschließend ohne Ankündigung.",
};

/** True when the turn ends on an announcement of work that was not done. Questions and finished answers do not count. */
export function announcesUndoneWork(text: unknown): boolean {
  if (typeof text !== "string") return false;
  const tail = text.trim().split(/\n{2,}/).at(-1)?.slice(-300) ?? "";
  return !tail.endsWith("?") && ANNOUNCEMENT.test(tail);
}

export function preview(value: unknown, maxChars = PREVIEW_CHARS): string {
  const text = typeof value === "string" ? value : JSON.stringify(value);
  return text.length > maxChars ? `${text.slice(0, maxChars)}…` : text;
}

export async function runAgentLoop(deps: LoopDeps): Promise<LoopOutcome> {
  const specs = deps.tools.map((tool) => tool.spec);
  let step = deps.stepsDone;
  let nudges = 0;
  let nudgeNext = false;

  while (step < deps.maxSteps) {
    if (deps.budget.remaining < STEP_RESERVE) return { kind: "paused", steps: step };
    step += 1;
    await deps.emit({ type: "thinking", data: { step } });

    let turn: ModelTurn;
    try {
      const reminder = nudgeNext ? [NUDGE] : [];
      nudgeNext = false;
      turn = await deps.model({ messages: [deps.system, ...deps.history.recent(), ...reminder], tools: specs }, (text) => deps.delta(step, text));
    } catch (error) {
      if (error instanceof BudgetExhausted) return { kind: "paused", steps: step - 1 };
      const message = error instanceof Error ? error.message : String(error);
      await deps.emit({ type: "error", data: { step, message } });
      return { kind: "failed", reply: `Das Modell hat nicht geantwortet: ${message}`, steps: step };
    }

    await deps.emit({
      type: "model_result",
      data: { step, model: turn.model, attempts: turn.attempts },
      tokensIn: turn.usage.inputTokens,
      tokensOut: turn.usage.outputTokens,
      costUsd: turn.costUsd,
    });
    deps.history.append(turn.message);

    const calls = turn.message.toolCalls ?? [];
    if (!calls.length) {
      // The reminder is not stored: it only steers the next model call, so the chat shows no message Ugur did not write.
      if (nudges < MAX_NUDGES && specs.length && announcesUndoneWork(turn.message.content ?? "")) {
        nudges += 1;
        nudgeNext = true;
        continue;
      }
      const content: unknown = turn.message.content;
      const reply = (typeof content === "string" ? content : content == null ? "" : JSON.stringify(content)).trim() || "(keine Antwort)";
      await deps.emit({ type: "message", data: { text: reply, step } });
      return { kind: "done", reply, steps: step };
    }

    let deferred = false;
    for (const call of calls) {
      // Every call needs a result message; once the budget is low the rest wait for the next stage.
      if (deferred || deps.budget.remaining < TOOL_RESERVE) {
        deferred = true;
        deps.history.append({
          role: "tool",
          toolCallId: call.id,
          content: JSON.stringify({ deferred: true, note: "Neue Etappe: rufe dieses Werkzeug erneut auf." }),
        });
        continue;
      }
      const output = await runTool(call, deps);
      deps.history.append({ role: "tool", toolCallId: call.id, content: output.slice(0, TOOL_RESULT_CHARS) });
    }
    if (deferred) return { kind: "paused", steps: step };
  }

  const reply = `Ich habe nach ${deps.maxSteps} Schritten angehalten, damit nichts aus dem Ruder läuft. Sag mir, ob ich weitermachen soll.`;
  await deps.emit({ type: "message", data: { text: reply, step } });
  return { kind: "step_limit", reply, steps: step };
}

async function runTool(call: ToolCall, deps: LoopDeps): Promise<string> {
  const tool = deps.tools.find((candidate) => candidate.spec.name === call.name);
  let args: Record<string, unknown>;
  try {
    args = JSON.parse(call.arguments || "{}") as Record<string, unknown>;
  } catch {
    return JSON.stringify({ error: "Argumente sind kein gültiges JSON." });
  }
  await deps.emit({ type: "tool_call", data: { tool: call.name, args: preview(args) } });
  if (!tool) return JSON.stringify({ error: `Werkzeug "${call.name}" steht dir nicht zur Verfügung.` });

  if (tool.requiresApproval) {
    const { approvalId, description } = await deps.requestApproval(call.name, args);
    await deps.emit({ type: "approval_requested", data: { approvalId, tool: call.name, ...description } });
    return JSON.stringify({
      status: "pending_approval",
      approvalId,
      note: "Ugur entscheidet über diese Aktion. Führe sie nicht erneut aus; sag ihm kurz, was du vorschlägst, und warte.",
    });
  }

  try {
    const result = await tool.run(args, deps.context);
    const resultPreview = call.name === "repo_read_pull_request" || call.name === "repo_check_status"
      ? preview(result, 40_000)
      : preview(result);
    await deps.emit({ type: "tool_result", data: { tool: call.name, ok: true, preview: resultPreview } });
    return JSON.stringify(result);
  } catch (error) {
    const message = error instanceof BudgetExhausted
      ? "Budget dieser Etappe erschöpft; in der nächsten Etappe erneut versuchen."
      : error instanceof Error ? error.message : String(error);
    await deps.emit({ type: "tool_result", data: { tool: call.name, ok: false, preview: message } });
    return JSON.stringify({ error: message });
  }
}
