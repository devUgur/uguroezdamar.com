import { DurableObject } from "cloudflare:workers";
import { AGENTS } from "./agents/registry.ts";
import { APPROVAL_TTL_SECONDS, describeApproval } from "./approvals.ts";
import type { Env } from "./env.ts";
import { emit, spentToday } from "./events.ts";
import type { ChatMessage, ToolCall } from "./models/port.ts";
import { ModelRouter, type PinnedModel } from "./models/router.ts";
import { SubrequestBudget } from "./runtime/budget.ts";
import { runAgentLoop, type LoopEvent } from "./runtime/loop.ts";
import type { Accepted, AgentRuntimePort, AgentStatus, ChatInput, ResumeInput } from "./runtime/port.ts";
import { projectMemories } from "./tools/workspace.ts";
import type { ToolContext } from "./tools/port.ts";
import { toolsByName } from "./tools/registry.ts";

export type { ChatInput, ResumeInput } from "./runtime/port.ts";

/** Steps per task across all stages; the loop stops there and asks Ugur. */
const MAX_STEPS = 24;
const HISTORY_LIMIT = 60;
/** A run without progress for this long is treated as dead (e.g. after a deploy). */
const STALE_RUN_MS = 15 * 60_000;
/** Live answer text is sent to browsers in batches, not per token. */
const DELTA_FLUSH_MS = 250;

interface MessageRow {
  [key: string]: SqlStorageValue;
  role: string;
  content: string | null;
  tool_calls: string | null;
  tool_call_id: string | null;
}

interface ProjectRow {
  id: string;
  name: string;
  repo: string | null;
}

interface RunState {
  threadId: string;
  agentId: string;
  projectId: string;
  steps: number;
  stages: number;
  startedAt: number;
  touchedAt: number;
}

const RUN = "run";
const INBOX = "inbox";

/**
 * One Durable Object per chat thread (idFromName("thread:<id>")), implementing AgentRuntimePort.
 * It keeps the thread's conversation in its own SQLite and runs the loop in stages: every stage is an alarm with
 * a fresh subrequest budget (Workers Free: 50 external calls per invocation). chat() and
 * resume() only queue work; results reach the portal as events through the live hub.
 */
export class AgentRuntime extends DurableObject<Env> implements AgentRuntimePort {
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    ctx.storage.sql.exec(`CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      role TEXT NOT NULL,
      content TEXT,
      tool_calls TEXT,
      tool_call_id TEXT,
      ts INTEGER NOT NULL
    )`);
  }

  async chat(input: ChatInput): Promise<Accepted> {
    await emit(this.env, {
      threadId: input.threadId,
      agentId: input.agentId,
      projectId: input.projectId,
      type: "user_message",
      data: { text: input.text },
    });
    return this.enqueue(input.threadId, input.agentId, input.projectId, input.text);
  }

  /** Called after Ugur decided on an approval: the agent learns the outcome and carries on. */
  async resume(input: ResumeInput): Promise<Accepted> {
    const note = `[System] Freigabe ${input.approvalId} für ${input.tool} wurde ${
      input.approved ? "erteilt und ausgeführt" : "abgelehnt"
    }. Ergebnis: ${input.outcome}`;
    return this.enqueue(input.threadId, input.agentId, input.projectId, note);
  }

  async stop(): Promise<void> {
    const run = await this.ctx.storage.get<RunState>(RUN);
    await this.ctx.storage.delete([RUN, INBOX]);
    await this.ctx.storage.deleteAlarm();
    if (run) {
      await emit(this.env, { threadId: run.threadId, agentId: run.agentId, projectId: run.projectId, type: "stopped", data: { steps: run.steps } });
    }
  }

  async status(): Promise<AgentStatus> {
    const run = await this.activeRun();
    return run ? { running: true, step: run.steps, startedAt: run.startedAt } : { running: false, step: 0 };
  }

  async history(): Promise<ChatMessage[]> {
    return this.recent(200);
  }

  async reset(): Promise<void> {
    await this.stop();
    this.ctx.storage.sql.exec("DELETE FROM messages");
  }

  /** Messages wait in the inbox until a stage boundary, so tool-call sequences stay intact. */
  private async enqueue(threadId: string, agentId: string, projectId: string, text: string): Promise<Accepted> {
    const inbox = (await this.ctx.storage.get<string[]>(INBOX)) ?? [];
    inbox.push(text);
    await this.ctx.storage.put(INBOX, inbox);
    if (await this.activeRun()) {
      return { accepted: true, busy: true, message: "Ich arbeite gerade; dein Hinweis fließt in den nächsten Schritt ein." };
    }
    const now = Date.now();
    await this.ctx.storage.put<RunState>(RUN, { threadId, agentId, projectId, steps: 0, stages: 0, startedAt: now, touchedAt: now });
    await this.ctx.storage.setAlarm(now);
    return { accepted: true };
  }

  private async activeRun(): Promise<RunState | undefined> {
    const run = await this.ctx.storage.get<RunState>(RUN);
    if (run && Date.now() - run.touchedAt > STALE_RUN_MS) {
      await this.ctx.storage.delete(RUN);
      return undefined;
    }
    return run;
  }

  override async alarm(): Promise<void> {
    const run = await this.ctx.storage.get<RunState>(RUN);
    if (!run) return;
    const base = { threadId: run.threadId, agentId: run.agentId, projectId: run.projectId };
    try {
      const inbox = (await this.ctx.storage.get<string[]>(INBOX)) ?? [];
      if (inbox.length) {
        for (const text of inbox) this.append({ role: "user", content: text });
        await this.ctx.storage.delete(INBOX);
      }

      const outcome = await this.stage(run);
      if (outcome === "paused") {
        await this.ctx.storage.put<RunState>(RUN, { ...run, stages: run.stages + 1, touchedAt: Date.now() });
        await emit(this.env, { ...base, type: "stage_paused", data: { steps: run.steps, stage: run.stages + 1 } });
        await this.ctx.storage.setAlarm(Date.now() + 200);
        return;
      }
      await this.ctx.storage.delete(RUN);
      // Something arrived while the run was finishing: start the next one right away.
      if (((await this.ctx.storage.get<string[]>(INBOX)) ?? []).length) {
        const now = Date.now();
        await this.ctx.storage.put<RunState>(RUN, { ...base, steps: 0, stages: 0, startedAt: now, touchedAt: now });
        await this.ctx.storage.setAlarm(now);
      }
    } catch (error) {
      // No rethrow: a retried alarm would repeat side effects. Report and end the run.
      await this.ctx.storage.delete(RUN);
      const message = error instanceof Error ? error.message : String(error);
      await emit(this.env, { ...base, type: "error", data: { message } }).catch(() => undefined);
    }
  }

  /** One stage of the loop; updates run.steps in place. */
  private async stage(run: RunState): Promise<"paused" | "ended"> {
    const { threadId, agentId, projectId } = run;
    const base = { threadId, agentId, projectId };
    const definition = AGENTS[agentId];
    if (!definition) throw new Error(`Unbekannter Agent "${agentId}"`);

    const [project, budgetRow, spent, thread] = await Promise.all([
      this.env.DB.prepare("SELECT id, name, repo FROM projects WHERE id = ?").bind(projectId).first<ProjectRow>(),
      this.env.DB.prepare("SELECT daily_budget_usd FROM agents WHERE id = ?").bind(agentId).first<{ daily_budget_usd: number }>(),
      spentToday(this.env, agentId),
      this.env.DB.prepare("SELECT model FROM threads WHERE id = ?").bind(threadId).first<{ model: string | null }>(),
    ]);
    const dailyBudget = budgetRow?.daily_budget_usd ?? 0.5;
    if (spent >= dailyBudget) {
      const reply = `Mein Tagesbudget von ${dailyBudget.toFixed(2)} $ ist aufgebraucht (${spent.toFixed(2)} $). Ich mache morgen weiter oder du erhöhst das Budget.`;
      await emit(this.env, { ...base, type: "budget_blocked", data: { budget: dailyBudget, spent } });
      await emit(this.env, { ...base, type: "message", data: { text: reply } });
      return "ended";
    }

    const repo = project?.repo ?? this.env.DEFAULT_REPO;
    const budget = new SubrequestBudget();
    const context: ToolContext = { env: this.env, agentId, projectId, repo, budget };
    const router = await ModelRouter.load(this.env);
    const pinned = parsePinned(thread?.model);
    const deltas = new DeltaBuffer(this.env, agentId, threadId);

    const outcome = await runAgentLoop({
      system: {
        role: "system",
        content: definition.systemPrompt({
          repo,
          projectName: project?.name ?? projectId,
          memories: await projectMemories(this.env.DB, projectId),
        }),
      },
      history: { recent: () => this.recent(HISTORY_LIMIT), append: (message) => this.append(message) },
      model: async (request, onDelta) => {
        const result = await router.chat(
          definition.modelAlias,
          { ...request, temperature: 0.3, maxTokens: 8192 },
          { budget, onDelta, pinned: pinned && router.offers(pinned) ? pinned : undefined },
        );
        await deltas.flush();
        return {
          message: result.message,
          usage: result.usage,
          costUsd: result.costUsd,
          model: `${result.target.provider}/${result.target.model}`,
          attempts: result.attempts,
        };
      },
      tools: toolsByName(definition.tools),
      context,
      budget,
      requestApproval: async (tool, args) => {
        const approvalId = crypto.randomUUID();
        const description = describeApproval(tool, args);
        await this.env.DB.prepare(
          `INSERT INTO approvals (id, agent_id, thread_id, action, details, summary, risk, warnings, expires_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, unixepoch() + ?)`,
        )
          .bind(
            approvalId,
            agentId,
            threadId,
            tool,
            JSON.stringify({ args, projectId, repo }),
            description.summary,
            description.risk,
            JSON.stringify(description.warnings),
            APPROVAL_TTL_SECONDS,
          )
          .run();
        return { approvalId, description };
      },
      emit: (event: LoopEvent) => emit(this.env, { ...base, ...event }).then(() => undefined),
      delta: (step, text) => deltas.push(step, text),
      stepsDone: run.steps,
      maxSteps: MAX_STEPS,
    });
    await deltas.flush();
    run.steps = outcome.steps;
    return outcome.kind === "paused" ? "paused" : "ended";
  }

  private append(message: ChatMessage): void {
    this.ctx.storage.sql.exec(
      "INSERT INTO messages (role, content, tool_calls, tool_call_id, ts) VALUES (?, ?, ?, ?, ?)",
      message.role,
      message.content,
      message.toolCalls ? JSON.stringify(message.toolCalls) : null,
      message.toolCallId ?? null,
      Date.now(),
    );
  }

  private recent(limit: number): ChatMessage[] {
    const rows = this.ctx.storage.sql
      .exec<MessageRow>("SELECT role, content, tool_calls, tool_call_id FROM messages ORDER BY id DESC LIMIT ?", limit)
      .toArray()
      .reverse();
    const messages: ChatMessage[] = rows.map((row) => ({
      role: row.role as ChatMessage["role"],
      content: row.content,
      toolCalls: row.tool_calls ? (JSON.parse(row.tool_calls) as ToolCall[]) : undefined,
      toolCallId: row.tool_call_id ?? undefined,
    }));
    // A window must not open with tool results whose call fell outside it.
    while (messages.length && messages[0]?.role === "tool") messages.shift();
    return messages;
  }
}

function parsePinned(value: string | null | undefined): PinnedModel | undefined {
  if (!value) return undefined;
  try {
    const parsed = JSON.parse(value) as Partial<PinnedModel>;
    return typeof parsed.provider === "string" && typeof parsed.model === "string" ? { provider: parsed.provider, model: parsed.model } : undefined;
  } catch {
    return undefined;
  }
}

/** Collects streamed answer text and sends it to the live hub every DELTA_FLUSH_MS. */
class DeltaBuffer {
  private text = "";
  private step = 0;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private sending: Promise<unknown> = Promise.resolve();

  constructor(
    private readonly env: Env,
    private readonly agentId: string,
    private readonly threadId: string,
  ) {}

  push(step: number, text: string): void {
    if (step !== this.step && this.text) void this.flush();
    this.step = step;
    this.text += text;
    this.timer ??= setTimeout(() => void this.flush(), DELTA_FLUSH_MS);
  }

  async flush(): Promise<void> {
    if (this.timer !== undefined) clearTimeout(this.timer);
    this.timer = undefined;
    if (this.text) {
      const message = JSON.stringify({ type: "delta", agentId: this.agentId, threadId: this.threadId, step: this.step, text: this.text });
      this.text = "";
      this.sending = this.sending
        .then(() => this.env.HUB.get(this.env.HUB.idFromName("main")).broadcast(message))
        .catch((error) => console.error("delta broadcast failed", error));
    }
    await this.sending;
  }
}
