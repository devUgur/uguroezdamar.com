import { readWorkingMemory } from "../knowledge/store.ts";
import { loadAgentSettings, stepsOf } from "../agents/settings.ts";
import { buildContext, PRIOR_MESSAGES, SUMMARIZE_AFTER, summaryPrompt, type ThreadSummary, unsummarized } from "./context.ts";
import { finishRun, recordModelCall, recordToolCall, spentTodayFromLedger, startRun } from "../usage/ledger.ts";
import { anyStrict, effectivePolicy } from "../projects/policy.ts";
import { AGENTS } from "../agents/registry.ts";
import { APPROVAL_TTL_SECONDS, describeApproval } from "../approvals.ts";
import type { Env } from "../env.ts";
import type { ActorStatePort } from "../platform/ports.ts";
import { emit } from "../events.ts";
import type { ChatMessage, ToolCall } from "../models/port.ts";
import { ModelRouter, type PinnedModel, type RoutedResult } from "../models/router.ts";
import { OWNER_TENANT } from "../tenancy.ts";
import { BudgetExhausted, SubrequestBudget } from "./budget.ts";
import { DELTA_FLUSH_MS, HISTORY_LIMIT, STALE_RUN_MS } from "./limits.ts";
import { runAgentLoop, type LoopEvent } from "./loop.ts";
import type { Accepted, AgentRuntimePort, AgentStatus, ChatInput, ResumeInput } from "./port.ts";
import { projectMemories } from "../tools/workspace.ts";
import type { ToolContext } from "../tools/port.ts";
import { toolsByName } from "../tools/registry.ts";

export type { ChatInput, ResumeInput } from "./port.ts";


interface MessageRow {
  [key: string]: SqlStorageValue;
  role: string;
  content: string | null;
  tool_calls: string | null;
  tool_call_id: string | null;
  raw: string | null;
}

interface ProjectRow {
  id: string;
  name: string;
  repo: string | null;
  status: string;
  /** 'private' projects only talk to models that never train on the content (see models/config.ts). */
  visibility: string;
  /** Explicit data policy, NULL follows visibility (projects/policy.ts). */
  model_policy: string | null;
}

interface RunState {
  tenantId: string;
  threadId: string;
  agentId: string;
  projectId: string;
  taskId?: string;
  steps: number;
  stages: number;
  startedAt: number;
  touchedAt: number;
  /** Row in the usage ledger (runs); missing on runs started before the ledger existed. */
  runId?: string;
  /** First message id of this run: everything from here goes to the model in full (runtime/context.ts). */
  historyFrom?: number;
}

const RUN = "run";
/** Running summary of the thread's earlier messages (runtime/context.ts). */
const SUMMARY = "summary";
const INBOX = "inbox";
/** Private repositories whose content entered this thread (legacy: true); see ToolContext.markPrivate. */
type PrivateMark = boolean | string[];
/** Set once private repository content entered this thread; see ToolContext.markPrivate. */
const PRIVATE_THREAD = "private";
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
 * The runtime of one chat thread, implementing AgentRuntimePort. On Cloudflare a Durable Object per thread hosts it
 * (cloudflare/agent-object.ts); it only needs ActorStatePort and Env (ADR 0040). It keeps the thread's conversation in its own SQLite and runs the loop in stages: every stage is an alarm with
 * a fresh subrequest budget (Workers Free: 50 external calls per invocation). chat() and
 * resume() only queue work; results reach the portal as events through the live hub.
 */
export class ThreadRuntime implements AgentRuntimePort {
  constructor(
    private readonly state: ActorStatePort,
    private readonly env: Env,
  ) {
    state.sql.exec(`CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      role TEXT NOT NULL,
      content TEXT,
      tool_calls TEXT,
      tool_call_id TEXT,
      ts INTEGER NOT NULL
    )`);
    // Added with native provider adapters (ADR 0033); older threads get the column on first start.
    const columns = state.sql.exec<{ name: string }>("SELECT name FROM pragma_table_info('messages')").toArray();
    if (!columns.some((column) => column.name === "raw")) state.sql.exec("ALTER TABLE messages ADD COLUMN raw TEXT");
  }

  async chat(input: ChatInput): Promise<Accepted> {
    await emit(this.env, {
      tenantId: input.tenantId,
      threadId: input.threadId,
      agentId: input.agentId,
      projectId: input.projectId,
      taskId: input.taskId,
      type: "user_message",
      data: { text: input.text },
    });
    return this.enqueue(input.tenantId, input.threadId, input.agentId, input.projectId, input.text, input.taskId);
  }

  /** Called after Ugur decided on an approval: the agent learns the outcome and carries on. */
  async resume(input: ResumeInput): Promise<Accepted> {
    const note = `[System] Freigabe ${input.approvalId} für ${input.tool} wurde ${
      input.approved ? "erteilt und ausgeführt" : "abgelehnt"
    }. Ergebnis: ${input.outcome}`;
    return this.enqueue(input.tenantId, input.threadId, input.agentId, input.projectId, note, input.taskId);
  }

  async stop(): Promise<void> {
    const run = await this.state.get<RunState>(RUN);
    await this.state.delete([RUN, INBOX]);
    await this.state.deleteAlarm();
    if (run) {
      if (run.runId) await finishRun(this.env, run.tenantId ?? OWNER_TENANT, run.runId, "stopped", { steps: run.steps, stages: run.stages, outcome: "gestoppt" });
      await emit(this.env, { tenantId: run.tenantId, threadId: run.threadId, agentId: run.agentId, projectId: run.projectId, taskId: run.taskId, type: "stopped", data: { steps: run.steps } });
      if (run.taskId) await this.finishTaskRun(run, "cancelled", "Agentenlauf gestoppt. Die Aufgabe kann nach Prüfung erneut gestartet werden.");
    }
  }

  /** True when content this thread has seen must stay with providers that do not evaluate it. */
  private async privateRestricted(tenantId: string): Promise<boolean> {
    const seen = await this.state.get<PrivateMark>(PRIVATE_THREAD);
    if (seen === true) return true;
    return Array.isArray(seen) ? anyStrict(this.env, tenantId, seen) : false;
  }

  async status(tenantId: string = OWNER_TENANT): Promise<AgentStatus> {
    const run = await this.activeRun();
    const base = run ? { running: true, step: run.steps, startedAt: run.startedAt } : { running: false, step: 0 };
    return { ...base, private: await this.privateRestricted(tenantId) };
  }

  async history(): Promise<ChatMessage[]> {
    return this.recent(200);
  }

  async reset(): Promise<void> {
    await this.stop();
    this.state.sql.exec("DELETE FROM messages");
    await this.state.delete([PRIVATE_THREAD, SUMMARY]);
  }

  /** Messages wait in the inbox until a stage boundary, so tool-call sequences stay intact. */
  private async enqueue(tenantId: string, threadId: string, agentId: string, projectId: string, text: string, taskId?: string): Promise<Accepted> {
    const inbox = (await this.state.get<string[]>(INBOX)) ?? [];
    inbox.push(text);
    await this.state.put(INBOX, inbox);
    if (await this.activeRun()) {
      return { accepted: true, busy: true, message: "Ich arbeite gerade; dein Hinweis fließt in den nächsten Schritt ein." };
    }
    const now = Date.now();
    await this.state.put<RunState>(RUN, await this.openRun({ tenantId, threadId, agentId, projectId, taskId, steps: 0, stages: 0, startedAt: now, touchedAt: now }));
    await this.state.setAlarm(now);
    return { accepted: true };
  }

  private async activeRun(): Promise<RunState | undefined> {
    const run = await this.state.get<RunState>(RUN);
    if (run && Date.now() - run.touchedAt > STALE_RUN_MS) {
      await this.state.delete(RUN);
      if (run.runId) await finishRun(this.env, run.tenantId ?? OWNER_TENANT, run.runId, "failed", { steps: run.steps, stages: run.stages, outcome: "abgelaufen" });
      if (run.taskId) await this.finishTaskRun(run, "failed", "Agentenlauf ist abgelaufen. Bitte Aufgabe prüfen und erneut starten.");
      return undefined;
    }
    return run;
  }

  async alarm(): Promise<void> {
    const run = await this.state.get<RunState>(RUN);
    if (!run) return;
    // A run stored before tenants existed belongs to the owner; one stored before the ledger gets its row now.
    run.tenantId ??= OWNER_TENANT;
    if (!run.runId) Object.assign(run, await this.openRun(run));
    const base = { tenantId: run.tenantId, threadId: run.threadId, agentId: run.agentId, projectId: run.projectId, taskId: run.taskId };
    try {
      run.historyFrom ??= this.nextMessageId();
      const inbox = (await this.state.get<string[]>(INBOX)) ?? [];
      if (inbox.length) {
        for (const text of inbox) this.append({ role: "user", content: text });
        await this.state.delete(INBOX);
      }

      const outcome = await this.stage(run);
      if (outcome.kind === "paused") {
        await this.state.put<RunState>(RUN, { ...run, stages: run.stages + 1, touchedAt: Date.now() });
        await emit(this.env, { ...base, type: "stage_paused", data: { steps: run.steps, stage: run.stages + 1 } });
        await this.state.setAlarm(Date.now() + 200);
        return;
      }
      if (run.runId) await finishRun(this.env, run.tenantId, run.runId, outcome.kind === "done" ? "done" : "failed", { steps: run.steps, stages: run.stages + 1, outcome: outcome.reply });
      const hasQueuedMessage = ((await this.state.get<string[]>(INBOX)) ?? []).length > 0;
      if (run.taskId && !hasQueuedMessage) await this.finishTaskRun(run, outcome.kind === "done" ? "done" : "failed", outcome.reply);
      await this.state.delete(RUN);
      // Something arrived while the run was finishing: start the next one right away.
      if (((await this.state.get<string[]>(INBOX)) ?? []).length) {
        const now = Date.now();
        await this.state.put<RunState>(RUN, await this.openRun({ ...base, steps: 0, stages: 0, startedAt: now, touchedAt: now }));
        await this.state.setAlarm(now);
      }
    } catch (error) {
      // No rethrow: a retried alarm would repeat side effects. Report and end the run.
      await this.state.delete(RUN);
      const message = error instanceof Error ? error.message : String(error);
      if (run.runId) await finishRun(this.env, run.tenantId, run.runId, "failed", { steps: run.steps, stages: run.stages + 1, outcome: message });
      if (run.taskId) await this.finishTaskRun(run, "failed", message).catch(() => undefined);
      await emit(this.env, { ...base, type: "error", data: { message } }).catch(() => undefined);
    }
  }

  /** One stage of the loop; updates run.steps in place. */
  private async stage(run: RunState): Promise<{ kind: "paused" } | { kind: "done" | "failed"; reply: string }> {
    const { tenantId, threadId, agentId, projectId } = run;
    const base = { tenantId, threadId, agentId, projectId, taskId: run.taskId };
    const definition = AGENTS[agentId];
    if (!definition) throw new Error(`Unbekannter Agent "${agentId}"`);

    const [project, budgetRow, spent, thread] = await Promise.all([
      this.env.DB.prepare("SELECT id, name, repo, status, visibility, model_policy FROM projects WHERE tenant_id = ? AND id = ?").bind(tenantId, projectId).first<ProjectRow>(),
      this.env.DB.prepare("/* tenant:platform */ SELECT daily_budget_usd FROM agents WHERE id = ?").bind(agentId).first<{ daily_budget_usd: number }>(),
      spentTodayFromLedger(this.env, tenantId, agentId),
      this.env.DB.prepare("SELECT model FROM threads WHERE tenant_id = ? AND id = ?").bind(tenantId, threadId).first<{ model: string | null }>(),
    ]);
    const settings = await loadAgentSettings(this.env, tenantId, agentId);
    const dailyBudget = settings.dailyBudgetUsd ?? budgetRow?.daily_budget_usd ?? 0.5;
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

    // Company scope (no project): no repository; reading needs repo=owner/name, writing needs a project.
    const repo = project?.repo ?? (projectId ? this.env.DEFAULT_REPO : "");
    const budget = new SubrequestBudget();
    const router = await ModelRouter.load(this.env, tenantId);
    const pinned = parsePinned(thread?.model);
    // Private content stays on models that do not evaluate it: always in a private project, in a chat pinned to
    // such a model (a failing model then never falls back to an evaluating provider), and in a thread that has
    // already received private content (marked by a tool, remembered for the whole thread).
    // The project's data policy decides (ADR 0033): private repositories are strict unless the owner opened them.
    let tainted = await this.privateRestricted(tenantId);
    const strictProject = project ? effectivePolicy(project) === "strict" : false;
    const privateContent = () => tainted || strictProject || Boolean(pinned && router.keepsContentPrivate(pinned));
    const context: ToolContext = {
      env: this.env,
      tenantId,
      agentId,
      threadId,
      projectId,
      repo,
      budget,
      markPrivate: async (repos) => {
        const seen = await this.state.get<PrivateMark>(PRIVATE_THREAD);
        const known = Array.isArray(seen) ? seen : [];
        const next = [...new Set([...known, ...repos.map((repo) => repo.toLowerCase())])];
        // A legacy mark (true) came without names and stays strict.
        await this.state.put(PRIVATE_THREAD, seen === true ? true : next);
        if (!tainted) tainted = seen === true || (await anyStrict(this.env, tenantId, next));
      },
    };
    // Every stage may run in a fresh object instance: the summary comes from storage, not from memory.
    this.summaryCache = (await this.state.get<ThreadSummary>(SUMMARY)) ?? null;
    this.workingMemory = (await readWorkingMemory(this.env, tenantId, agentId, projectId))?.content ?? null;
    if (run.stages === 0 && run.historyFrom !== undefined) {
      await this.summarize({ tenantId, agentId, projectId, threadId, taskId: run.taskId, runId: run.runId, runFrom: run.historyFrom, router, budget, strict: privateContent() });
    }
    const deltas = new DeltaBuffer(this.env, agentId, threadId);
    // The step the loop is in and the arguments of the tool call in flight, for the usage ledger.
    let step = run.steps;
    const currentStep = () => step + 1;
    const toolArgs = new Map<string, string>();

    const outcome = await runAgentLoop({
      system: {
        role: "system",
        content: definition.systemPrompt({
          repo,
          projectName: project?.name ?? projectId,
          memories: definition.useProjectMemory === false ? [] : await projectMemories(this.env.DB, tenantId, projectId),
        }),
      },
      history: { recent: () => this.context(run.historyFrom), append: (message) => this.append(message) },
      model: async (request, onDelta) => {
        const started = Date.now();
        let firstToken: number | null = null;
        const strict = privateContent();
        const call = { tenantId, runId: run.runId, agentId, projectId, threadId, taskId: run.taskId, step: currentStep(), alias: definition.modelAlias, strictPolicy: strict };
        let result: RoutedResult;
        try {
          result = await router.chat(
            definition.modelAlias,
            { ...request, temperature: 0.3, maxTokens: 8192, effort: settings.effort ?? undefined },
            {
              budget,
              preferred: settings.model ?? undefined,
              onDelta: (text) => {
                firstToken ??= Date.now() - started;
                onDelta(text);
              },
              pinned: pinned && router.offers(pinned) ? pinned : undefined,
              privateContent: strict,
            },
          );
        } catch (error) {
          if (!(error instanceof BudgetExhausted)) {
            await recordModelCall(this.env, { ...call, provider: "router", model: definition.modelAlias, status: "error", latencyMs: Date.now() - started, error: error instanceof Error ? error.message : String(error) });
          }
          throw error;
        }
        await recordModelCall(this.env, {
          ...call,
          provider: result.target.provider,
          model: result.target.model,
          status: "ok",
          tokensIn: result.usage.inputTokens,
          tokensOut: result.usage.outputTokens,
          cacheReadTokens: result.usage.cacheReadTokens,
          cacheWriteTokens: result.usage.cacheWriteTokens,
          inputUsdPerM: result.target.inputUsdPerM,
          outputUsdPerM: result.target.outputUsdPerM,
          priceSource: result.priceSource,
          costUsd: result.costUsd,
          latencyMs: Date.now() - started,
          firstTokenMs: firstToken,
          keySource: result.keySource,
          attempts: result.attempts,
        });
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
          `INSERT INTO approvals (id, tenant_id, agent_id, thread_id, task_id, action, details, summary, risk, warnings, expires_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, unixepoch() + ?)`,
        )
          .bind(
            approvalId,
            tenantId,
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
      emit: async (event: LoopEvent) => {
        const data = (event.data ?? {}) as Record<string, unknown>;
        if (event.type === "thinking" && typeof data.step === "number") step = data.step - 1;
        await emit(this.env, { ...base, ...event });
        if (event.type === "tool_call") {
          toolArgs.set(String(data.tool), typeof data.args === "string" ? data.args : JSON.stringify(data.args ?? ""));
        } else if (event.type === "tool_result" || event.type === "approval_requested") {
          await recordToolCall(this.env, {
            tenantId,
            runId: run.runId,
            agentId,
            projectId,
            step: typeof data.step === "number" ? data.step : currentStep(),
            tool: String(data.tool ?? "unbekannt"),
            argsPreview: toolArgs.get(String(data.tool)),
            ok: event.type === "approval_requested" ? true : data.ok === true,
            approvalId: typeof data.approvalId === "string" ? data.approvalId : null,
            durationMs: typeof data.durationMs === "number" ? data.durationMs : null,
            resultPreview: typeof data.preview === "string" ? data.preview : typeof data.summary === "string" ? data.summary : null,
          });
        }
      },
      delta: (step, text) => deltas.push(step, text),
      stepsDone: run.steps,
      maxSteps: stepsOf(settings),
    });
    await deltas.flush();
    run.steps = outcome.steps;
    if (outcome.kind === "paused") return { kind: "paused" };
    return outcome.kind === "done" ? { kind: "done", reply: outcome.reply } : { kind: "failed", reply: outcome.reply };
  }

  /** Gives a run its row in the usage ledger. */
  private async openRun(run: RunState): Promise<RunState> {
    const runId = run.runId ?? crypto.randomUUID();
    const kind = !run.taskId ? "chat" : run.agentId === "reviewer" ? "review" : "task";
    await startRun(this.env, { id: runId, tenantId: run.tenantId ?? OWNER_TENANT, agentId: run.agentId, projectId: run.projectId, threadId: run.threadId, taskId: run.taskId, kind, startedAt: run.startedAt });
    return { ...run, runId };
  }

  private async finishTaskRun(run: RunState, outcome: "done" | "failed" | "cancelled", output: string): Promise<void> {
    if (!run.taskId) return;
    const review = await this.env.DB.prepare("/* tenant:parent */ SELECT id FROM task_reviews WHERE thread_id = ? AND status = 'running'")
      .bind(run.threadId).first<{ id: string }>();
    if (review) {
      await this.finishTaskReview(run, review.id, outcome, output);
      return;
    }
    const status = outcome === "done" ? "review" : "blocked";
    const result = await this.env.DB.prepare(
      "/* tenant:parent */ UPDATE tasks SET status = ?, output = ?, updated_at = unixepoch() WHERE id = ? AND status = 'in_progress'",
    ).bind(status, output.slice(0, 5_000), run.taskId).run();
    if (!result.meta.changes) return;
    await emit(this.env, {
      tenantId: run.tenantId,
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
        this.env.DB.prepare("/* tenant:parent */ SELECT t.acceptance_criteria FROM task_reviews r JOIN tasks t ON t.id = r.task_id WHERE r.id = ? AND r.thread_id = ?")
          .bind(reviewId, run.threadId).first<{ acceptance_criteria: string | null }>(),
        this.env.DB.prepare("/* tenant:parent */ SELECT type, data FROM events WHERE thread_id = ? AND type = 'tool_result' ORDER BY id")
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
        `/* tenant:parent */ UPDATE tasks SET status = ?, updated_at = unixepoch()
          WHERE id = ? AND status = 'qa' AND EXISTS (
            SELECT 1 FROM task_reviews WHERE id = ? AND status = 'running'
          )`,
      ).bind(nextTaskStatus, run.taskId, reviewId),
      this.env.DB.prepare(
        `/* tenant:parent */ UPDATE task_reviews SET status = ?, verdict = ?, summary = ?, findings = ?, evidence = ?, raw_output = ?, error = ?, completed_at = unixepoch()
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
      tenantId: run.tenantId,
      agentId: run.agentId,
      threadId: run.threadId,
      taskId: run.taskId,
      projectId: run.projectId,
      type: "task_review_completed",
      data: { reviewId, status, verdict, findings: result?.findings ?? [] },
    });
    await emit(this.env, {
      tenantId: run.tenantId,
      threadId: run.threadId,
      taskId: run.taskId,
      projectId: run.projectId,
      type: "task_updated",
      data: { status: nextTaskStatus, reviewerId: run.agentId, reviewId, verdict, source: "qa-runtime" },
    });
  }

  private append(message: ChatMessage): void {
    this.state.sql.exec(
      "INSERT INTO messages (role, content, tool_calls, tool_call_id, raw, ts) VALUES (?, ?, ?, ?, ?, ?)",
      message.role,
      message.content,
      message.toolCalls ? JSON.stringify(message.toolCalls) : null,
      message.toolCallId ?? null,
      message.raw ? JSON.stringify(message.raw) : null,
      Date.now(),
    );
  }

  private nextMessageId(): number {
    const row = this.state.sql.exec<{ next: number }>("SELECT COALESCE(MAX(id), 0) + 1 AS next FROM messages").one();
    return Number(row.next);
  }

  /** The thread as the model sees it in this run (runtime/context.ts); runs from before the builder keep the old window. */
  private context(runFrom: number | undefined): ChatMessage[] {
    if (runFrom === undefined) return this.recent(HISTORY_LIMIT);
    const rows = this.state.sql
      .exec<MessageRow & { id: number }>(
        "SELECT id, role, content, tool_calls, tool_call_id, raw FROM messages WHERE id >= ? OR id IN (SELECT id FROM messages WHERE id < ? ORDER BY id DESC LIMIT ?) ORDER BY id",
        runFrom,
        runFrom,
        PRIOR_MESSAGES,
      )
      .toArray();
    return buildContext(rows.map((row) => ({ id: Number(row.id), ...toMessage(row) })), runFrom, this.summaryCache, this.workingMemory);
  }

  private summaryCache: ThreadSummary | null = null;
  private workingMemory: string | null = null;

  /**
   * Folds earlier messages into the thread summary with the cheap role model, once at the start of a run and only when
   * enough has piled up. A failure keeps the old summary; the run goes on either way.
   */
  private async summarize(input: { tenantId: string; agentId: string; projectId: string; threadId: string; taskId?: string; runId?: string; runFrom: number; router: ModelRouter; budget: SubrequestBudget; strict: boolean }): Promise<void> {
    this.summaryCache = (await this.state.get<ThreadSummary>(SUMMARY)) ?? null;
    const rows = this.state.sql
      .exec<MessageRow & { id: number }>("SELECT id, role, content, tool_calls, tool_call_id, raw FROM messages WHERE id > ? AND id < ? ORDER BY id", this.summaryCache?.upTo ?? 0, input.runFrom)
      .toArray()
      .map((row) => ({ id: Number(row.id), ...toMessage(row) }));
    const pending = unsummarized(rows, input.runFrom, this.summaryCache);
    if (pending.length < SUMMARIZE_AFTER) return;
    const started = Date.now();
    try {
      const result = await input.router.chat("worker-cheap", { messages: summaryPrompt(this.summaryCache, pending), temperature: 0.2, maxTokens: 1_200 }, { budget: input.budget, privateContent: input.strict });
      const text = result.message.content?.trim();
      if (text) {
        this.summaryCache = { text: text.slice(0, 4_000), upTo: pending.at(-1)?.id ?? this.summaryCache?.upTo ?? 0 };
        await this.state.put(SUMMARY, this.summaryCache);
      }
      await recordModelCall(this.env, {
        tenantId: input.tenantId, runId: input.runId, agentId: input.agentId, projectId: input.projectId, threadId: input.threadId, taskId: input.taskId,
        step: 0, alias: "context-summary", provider: result.target.provider, model: result.target.model, status: "ok",
        tokensIn: result.usage.inputTokens, tokensOut: result.usage.outputTokens, cacheReadTokens: result.usage.cacheReadTokens,
        inputUsdPerM: result.target.inputUsdPerM, outputUsdPerM: result.target.outputUsdPerM, priceSource: result.priceSource, costUsd: result.costUsd,
        latencyMs: Date.now() - started, keySource: result.keySource, strictPolicy: input.strict, attempts: result.attempts,
      });
    } catch (error) {
      console.error("thread summary failed", error instanceof Error ? error.message : error);
      await recordModelCall(this.env, {
        tenantId: input.tenantId, runId: input.runId, agentId: input.agentId, projectId: input.projectId, threadId: input.threadId,
        step: 0, alias: "context-summary", provider: "router", model: "worker-cheap", status: "error", latencyMs: Date.now() - started,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private recent(limit: number): ChatMessage[] {
    const rows = this.state.sql
      .exec<MessageRow>("SELECT role, content, tool_calls, tool_call_id, raw FROM messages ORDER BY id DESC LIMIT ?", limit)
      .toArray()
      .reverse();
    const messages: ChatMessage[] = rows.map(toMessage);
    // A window must not open with tool results whose call fell outside it.
    while (messages.length && messages[0]?.role === "tool") messages.shift();
    return messages;
  }
}

function toMessage(row: MessageRow): ChatMessage {
  return {
    role: row.role as ChatMessage["role"],
    content: row.content,
    toolCalls: row.tool_calls ? (JSON.parse(row.tool_calls) as ToolCall[]) : undefined,
    toolCallId: row.tool_call_id ?? undefined,
    raw: row.raw ? (JSON.parse(row.raw) as ChatMessage["raw"]) : undefined,
  };
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
        .then(() => this.env.HUB.get("main").broadcast(message))
        .catch((error) => console.error("delta broadcast failed", error));
    }
    await this.sending;
  }
}
