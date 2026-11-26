import { DurableObject } from "cloudflare:workers";
import { AGENTS } from "./agents/registry.ts";
import { APPROVAL_TTL_SECONDS, describeApproval } from "./approvals.ts";
import type { Env } from "./env.ts";
import { emit, spentToday } from "./events.ts";
import type { ChatMessage, ToolCall } from "./models/port.ts";
import { ModelRouter, type PinnedModel } from "./models/router.ts";
import { SubrequestBudget } from "./runtime/budget.ts";
import { DELTA_FLUSH_MS, HISTORY_LIMIT, MAX_STEPS, STALE_RUN_MS } from "./runtime/limits.ts";
import { runAgentLoop, type LoopEvent } from "./runtime/loop.ts";
import type { Accepted, AgentRuntimePort, AgentStatus, ChatInput, ResumeInput } from "./runtime/port.ts";
import { projectMemories } from "./tools/workspace.ts";
import type { ToolContext } from "./tools/port.ts";
import { toolsByName } from "./tools/registry.ts";

export type { ChatInput, ResumeInput } from "./runtime/port.ts";


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
  status: string;
  /** 'private' projects only talk to models that never train on the content (see models/config.ts). */
  visibility: string;
}

interface RunState {
  threadId: string;
  agentId: string;
  projectId: string;
  taskId?: string;
  steps: number;
  stages: number;
  startedAt: number;
  touchedAt: number;
}

const RUN = "run";
const INBOX = "inbox";
type ReviewVerdict = "pass" | "changes_requested" | "needs_human";

interface ReviewResult {
  verdict: ReviewVerdict;
  summary: string;
  findings: string[];
  evidence: string[];
}

function parseReviewResult(output: string): ReviewResult {
  const fallback: ReviewResult = {
    verdict: "needs_human",
    summary: "Strukturiertes Prüfergebnis fehlt oder ist ungültig; menschliche Prüfung erforderlich.",
    findings: [],
    evidence: [],
  };
  const candidate = output.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1] ?? output.slice(output.indexOf("{"), output.lastIndexOf("}") + 1);
  if (!candidate) return fallback;
  try {
    const value: unknown = JSON.parse(candidate);
    if (!value || typeof value !== "object") return fallback;
    const record = value as Record<string, unknown>;
    const verdict = record.verdict;
    if (verdict !== "pass" && verdict !== "changes_requested" && verdict !== "needs_human") return fallback;
    const list = (entry: unknown) => Array.isArray(entry)
      ? entry.filter((item): item is string => typeof item === "string").slice(0, 20).map((item) => item.slice(0, 1_000))
      : [];
    return {
      verdict,
      summary: typeof record.summary === "string" ? record.summary.slice(0, 2_000) : fallback.summary,
      findings: list(record.findings),
      evidence: list(record.evidence),
    };
  } catch {
    return fallback;
  }
}

function reviewHasPassingEvidence(
  criteria: string | null,
  events: { type: string; data: string | null }[],
  evidence: string[],
): boolean {
  if (!criteria?.trim() || !evidence.length) return false;
  const results = new Map<string, unknown | null>();
  for (const event of events) {
    if (event.type !== "tool_result" || !event.data) continue;
    let tool: string | null = null;
    try {
      const data = JSON.parse(event.data) as Record<string, unknown>;
      tool = typeof data.tool === "string" ? data.tool : null;
      if (tool === "repo_read_pull_request" || tool === "repo_check_status") {
        results.set(tool, data.ok === true && typeof data.preview === "string" ? JSON.parse(data.preview) : null);
      }
    } catch {
      // Truncated or malformed tool output is not evidence for an automatic pass.
      if (tool === "repo_read_pull_request" || tool === "repo_check_status") results.set(tool, null);
    }
  }
  const pull = results.get("repo_read_pull_request") as { truncated?: boolean; head?: { sha?: string }; files?: { patch?: string; patchTruncated?: boolean }[] } | null | undefined;
  const checkResult = results.get("repo_check_status") as { ref?: string; checks?: unknown[] } | null | undefined;
  const checks = checkResult?.checks;
  return Boolean(
    pull && pull.truncated === false && Array.isArray(pull.files) && pull.files.length > 0 &&
    pull.files.every((file) => typeof file.patch === "string" && !file.patchTruncated) &&
    Boolean(pull.head?.sha && checkResult?.ref === pull.head.sha) && Array.isArray(checks) && checks.length > 0 &&
    checks.every((check) => check && typeof check === "object" &&
      (check as Record<string, unknown>).status === "completed" &&
      (check as Record<string, unknown>).conclusion === "success"),
  );
}

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
      taskId: input.taskId,
      type: "user_message",
      data: { text: input.text },
    });
    return this.enqueue(input.threadId, input.agentId, input.projectId, input.text, input.taskId);
  }

  /** Called after Ugur decided on an approval: the agent learns the outcome and carries on. */
  async resume(input: ResumeInput): Promise<Accepted> {
    const note = `[System] Freigabe ${input.approvalId} für ${input.tool} wurde ${
      input.approved ? "erteilt und ausgeführt" : "abgelehnt"
    }. Ergebnis: ${input.outcome}`;
    return this.enqueue(input.threadId, input.agentId, input.projectId, note, input.taskId);
  }

  async stop(): Promise<void> {
    const run = await this.ctx.storage.get<RunState>(RUN);
    await this.ctx.storage.delete([RUN, INBOX]);
    await this.ctx.storage.deleteAlarm();
    if (run) {
      await emit(this.env, { threadId: run.threadId, agentId: run.agentId, projectId: run.projectId, taskId: run.taskId, type: "stopped", data: { steps: run.steps } });
      if (run.taskId) await this.finishTaskRun(run, "cancelled", "Agentenlauf gestoppt. Die Aufgabe kann nach Prüfung erneut gestartet werden.");
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
  private async enqueue(threadId: string, agentId: string, projectId: string, text: string, taskId?: string): Promise<Accepted> {
    const inbox = (await this.ctx.storage.get<string[]>(INBOX)) ?? [];
    inbox.push(text);
    await this.ctx.storage.put(INBOX, inbox);
    if (await this.activeRun()) {
      return { accepted: true, busy: true, message: "Ich arbeite gerade; dein Hinweis fließt in den nächsten Schritt ein." };
    }
    const now = Date.now();
    await this.ctx.storage.put<RunState>(RUN, { threadId, agentId, projectId, taskId, steps: 0, stages: 0, startedAt: now, touchedAt: now });
    await this.ctx.storage.setAlarm(now);
    return { accepted: true };
  }

  private async activeRun(): Promise<RunState | undefined> {
    const run = await this.ctx.storage.get<RunState>(RUN);
    if (run && Date.now() - run.touchedAt > STALE_RUN_MS) {
      await this.ctx.storage.delete(RUN);
      if (run.taskId) await this.finishTaskRun(run, "failed", "Agentenlauf ist abgelaufen. Bitte Aufgabe prüfen und erneut starten.");
      return undefined;
    }
    return run;
  }

  override async alarm(): Promise<void> {
    const run = await this.ctx.storage.get<RunState>(RUN);
    if (!run) return;
    const base = { threadId: run.threadId, agentId: run.agentId, projectId: run.projectId, taskId: run.taskId };
    try {
      const inbox = (await this.ctx.storage.get<string[]>(INBOX)) ?? [];
      if (inbox.length) {
        for (const text of inbox) this.append({ role: "user", content: text });
        await this.ctx.storage.delete(INBOX);
      }

      const outcome = await this.stage(run);
      if (outcome.kind === "paused") {
        await this.ctx.storage.put<RunState>(RUN, { ...run, stages: run.stages + 1, touchedAt: Date.now() });
        await emit(this.env, { ...base, type: "stage_paused", data: { steps: run.steps, stage: run.stages + 1 } });
        await this.ctx.storage.setAlarm(Date.now() + 200);
        return;
      }
      const hasQueuedMessage = ((await this.ctx.storage.get<string[]>(INBOX)) ?? []).length > 0;
      if (run.taskId && !hasQueuedMessage) await this.finishTaskRun(run, outcome.kind === "done" ? "done" : "failed", outcome.reply);
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
      if (run.taskId) await this.finishTaskRun(run, "failed", message).catch(() => undefined);
      await emit(this.env, { ...base, type: "error", data: { message } }).catch(() => undefined);
    }
  }

  /** One stage of the loop; updates run.steps in place. */
  private async stage(run: RunState): Promise<{ kind: "paused" } | { kind: "done" | "failed"; reply: string }> {
    const { threadId, agentId, projectId } = run;
    const base = { threadId, agentId, projectId, taskId: run.taskId };
    const definition = AGENTS[agentId];
    if (!definition) throw new Error(`Unbekannter Agent "${agentId}"`);

    const [project, budgetRow, spent, thread] = await Promise.all([
      this.env.DB.prepare("SELECT id, name, repo, status, visibility FROM projects WHERE id = ?").bind(projectId).first<ProjectRow>(),
      this.env.DB.prepare("SELECT daily_budget_usd FROM agents WHERE id = ?").bind(agentId).first<{ daily_budget_usd: number }>(),
      spentToday(this.env, agentId),
      this.env.DB.prepare("SELECT model FROM threads WHERE id = ?").bind(threadId).first<{ model: string | null }>(),
    ]);
    const dailyBudget = budgetRow?.daily_budget_usd ?? 0.5;
    if (spent >= dailyBudget) {
      const reply = `Mein Tagesbudget von ${dailyBudget.toFixed(2)} $ ist aufgebraucht (${spent.toFixed(2)} $). Ich mache morgen weiter oder du erhöhst das Budget.`;
      await emit(this.env, { ...base, type: "budget_blocked", data: { budget: dailyBudget, spent } });
      await emit(this.env, { ...base, type: "message", data: { text: reply } });
      return { kind: "failed", reply };
    }

    if (project && project.status !== "active") {
      const reply = `Das Projekt „${project.name}“ wurde aus der Projektliste entfernt. Ich arbeite dort nicht weiter; wähle ein anderes Projekt oder registriere das Repository neu.`;
      await emit(this.env, { ...base, type: "message", data: { text: reply } });
      return { kind: "failed", reply };
    }

    const repo = project?.repo ?? this.env.DEFAULT_REPO;
    const budget = new SubrequestBudget();
    const router = await ModelRouter.load(this.env);
    const pinned = parsePinned(thread?.model);
    // Private content stays on models that do not evaluate it: always in a private project, and in any chat
    // whose pinned model is such a model (then a failing model never falls back to an evaluating provider).
    const privateContent = project?.visibility === "private" || Boolean(pinned && router.keepsContentPrivate(pinned));
    const context: ToolContext = { env: this.env, agentId, projectId, repo, budget, allowPrivate: privateContent };
    const deltas = new DeltaBuffer(this.env, agentId, threadId);

    const outcome = await runAgentLoop({
      system: {
        role: "system",
        content: definition.systemPrompt({
          repo,
          projectName: project?.name ?? projectId,
          memories: definition.useProjectMemory === false ? [] : await projectMemories(this.env.DB, projectId),
        }),
      },
      history: { recent: () => this.recent(HISTORY_LIMIT), append: (message) => this.append(message) },
      model: async (request, onDelta) => {
        const result = await router.chat(
          definition.modelAlias,
          { ...request, temperature: 0.3, maxTokens: 8192 },
          { budget, onDelta, pinned: pinned && router.offers(pinned) ? pinned : undefined, privateContent },
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
          `INSERT INTO approvals (id, agent_id, thread_id, task_id, action, details, summary, risk, warnings, expires_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, unixepoch() + ?)`,
        )
          .bind(
            approvalId,
            agentId,
            threadId,
            run.taskId ?? null,
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
    if (outcome.kind === "paused") return { kind: "paused" };
    return outcome.kind === "done" ? { kind: "done", reply: outcome.reply } : { kind: "failed", reply: outcome.reply };
  }

  private async finishTaskRun(run: RunState, outcome: "done" | "failed" | "cancelled", output: string): Promise<void> {
    if (!run.taskId) return;
    const review = await this.env.DB.prepare("SELECT id FROM task_reviews WHERE thread_id = ? AND status = 'running'")
      .bind(run.threadId).first<{ id: string }>();
    if (review) {
      await this.finishTaskReview(run, review.id, outcome, output);
      return;
    }
    const status = outcome === "done" ? "review" : "blocked";
    const result = await this.env.DB.prepare(
      "UPDATE tasks SET status = ?, output = ?, updated_at = unixepoch() WHERE id = ? AND status = 'in_progress'",
    ).bind(status, output.slice(0, 5_000), run.taskId).run();
    if (!result.meta.changes) return;
    await emit(this.env, {
      taskId: run.taskId,
      projectId: run.projectId,
      type: "task_updated",
      data: { status, agentId: run.agentId, threadId: run.threadId, source: "agent-runtime" },
    });
  }

  private async finishTaskReview(run: RunState, reviewId: string, outcome: "done" | "failed" | "cancelled", output: string): Promise<void> {
    let result = outcome === "done" ? parseReviewResult(output) : null;
    if (result?.verdict === "pass") {
      const [review, events] = await Promise.all([
        this.env.DB.prepare("SELECT t.acceptance_criteria FROM task_reviews r JOIN tasks t ON t.id = r.task_id WHERE r.id = ? AND r.thread_id = ?")
          .bind(reviewId, run.threadId).first<{ acceptance_criteria: string | null }>(),
        this.env.DB.prepare("SELECT type, data FROM events WHERE thread_id = ? AND type = 'tool_result' ORDER BY id")
          .bind(run.threadId).all<{ type: string; data: string | null }>(),
      ]);
      if (!reviewHasPassingEvidence(review?.acceptance_criteria ?? null, events.results, result.evidence)) {
        result = {
          ...result,
          verdict: "needs_human",
          summary: "Ein automatisches Bestehen ist nicht ausreichend belegt: Abnahmekriterien, vollständiger PR-Diff oder erfolgreiche abgeschlossene CI-Checks fehlen.",
        };
      }
    }
    const status = outcome === "done" ? "completed" : outcome;
    const verdict = result?.verdict ?? null;
    const nextTaskStatus = outcome !== "done" ? "blocked" : verdict === "changes_requested" ? "in_progress" : "qa";
    const statements = await this.env.DB.batch([
      this.env.DB.prepare(
        `UPDATE tasks SET status = ?, updated_at = unixepoch()
          WHERE id = ? AND status = 'qa' AND EXISTS (
            SELECT 1 FROM task_reviews WHERE id = ? AND status = 'running'
          )`,
      ).bind(nextTaskStatus, run.taskId, reviewId),
      this.env.DB.prepare(
        `UPDATE task_reviews SET status = ?, verdict = ?, summary = ?, findings = ?, evidence = ?, raw_output = ?, error = ?, completed_at = unixepoch()
          WHERE id = ? AND status = 'running'`,
      ).bind(
        status,
        verdict,
        result?.summary ?? (outcome === "done" ? "Prüfergebnis nicht lesbar; menschliche Prüfung erforderlich." : null),
        JSON.stringify(result?.findings ?? []),
        JSON.stringify(result?.evidence ?? []),
        output.slice(0, 12_000),
        outcome === "done" ? null : output.slice(0, 2_000),
        reviewId,
      ),
    ]);
    if (!statements[1]?.meta.changes) return;
    await emit(this.env, {
      agentId: run.agentId,
      threadId: run.threadId,
      taskId: run.taskId,
      projectId: run.projectId,
      type: "task_review_completed",
      data: { reviewId, status, verdict, findings: result?.findings ?? [] },
    });
    await emit(this.env, {
      threadId: run.threadId,
      taskId: run.taskId,
      projectId: run.projectId,
      type: "task_updated",
      data: { status: nextTaskStatus, reviewerId: run.agentId, reviewId, verdict, source: "qa-runtime" },
    });
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
