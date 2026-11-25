import { DurableObject } from "cloudflare:workers";
import { AGENTS } from "./agents/registry.ts";
import type { Env } from "./env.ts";
import { emit, spentToday } from "./events.ts";
import type { ChatMessage, ToolCall } from "./models/port.ts";
import { ModelRouter } from "./models/router.ts";
import { projectMemories } from "./tools/platform.ts";
import type { ToolContext } from "./tools/port.ts";
import { toolByName, toolsByName } from "./tools/registry.ts";

const MAX_STEPS = 12;
const HISTORY_LIMIT = 60;
const TOOL_RESULT_CHARS = 20_000;
const PREVIEW_CHARS = 600;

export interface ChatInput {
  agentId: string;
  projectId: string;
  text: string;
}

export interface ResumeInput {
  agentId: string;
  projectId: string;
  approvalId: string;
  tool: string;
  approved: boolean;
  outcome: string;
}

export interface ChatOutput {
  reply: string;
  busy?: boolean;
}

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

function preview(value: unknown): string {
  const text = typeof value === "string" ? value : JSON.stringify(value);
  return text.length > PREVIEW_CHARS ? `${text.slice(0, PREVIEW_CHARS)}…` : text;
}

/**
 * One Durable Object per agent (idFromName(agentId)). It keeps the agent's conversation in its
 * own SQLite and runs the think → tool → answer loop. Everything it does is emitted as an event.
 */
export class AgentRuntime extends DurableObject<Env> {
  private busy = false;

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

  async chat(input: ChatInput): Promise<ChatOutput> {
    if (this.busy) return { reply: "Ich arbeite noch an der vorherigen Aufgabe. Einen Moment bitte.", busy: true };
    this.busy = true;
    try {
      this.append({ role: "user", content: input.text });
      await emit(this.env, { agentId: input.agentId, projectId: input.projectId, type: "user_message", data: { text: input.text } });
      return await this.run(input.agentId, input.projectId);
    } finally {
      this.busy = false;
    }
  }

  /** Called after Ugur decided on an approval: the agent learns the outcome and carries on. */
  async resume(input: ResumeInput): Promise<ChatOutput> {
    if (this.busy) return { reply: "Ich arbeite noch; die Freigabe wird danach berücksichtigt.", busy: true };
    this.busy = true;
    try {
      this.append({
        role: "user",
        content: `[Plattform] Freigabe ${input.approvalId} für ${input.tool} wurde ${input.approved ? "erteilt und ausgeführt" : "abgelehnt"}. Ergebnis: ${input.outcome}`,
      });
      return await this.run(input.agentId, input.projectId);
    } finally {
      this.busy = false;
    }
  }

  history(): ChatMessage[] {
    return this.recent(200);
  }

  reset(): void {
    this.ctx.storage.sql.exec("DELETE FROM messages");
  }

  private async run(agentId: string, projectId: string): Promise<ChatOutput> {
    const definition = AGENTS[agentId];
    if (!definition) throw new Error(`Unbekannter Agent "${agentId}"`);

    const project = await this.env.DB.prepare("SELECT id, name, repo FROM projects WHERE id = ?").bind(projectId).first<ProjectRow>();
    const repo = project?.repo ?? this.env.DEFAULT_REPO;
    const context: ToolContext = { env: this.env, agentId, projectId, repo };
    const base = { agentId, projectId };

    const budgetRow = await this.env.DB.prepare("SELECT daily_budget_usd FROM agents WHERE id = ?").bind(agentId).first<{ daily_budget_usd: number }>();
    const budget = budgetRow?.daily_budget_usd ?? 0.5;
    const spent = await spentToday(this.env, agentId);
    if (spent >= budget) {
      const reply = `Mein Tagesbudget von ${budget.toFixed(2)} $ ist aufgebraucht (${spent.toFixed(2)} $). Ich mache morgen weiter oder du erhöhst das Budget.`;
      await emit(this.env, { ...base, type: "budget_blocked", data: { budget, spent } });
      return { reply };
    }

    const router = await ModelRouter.load(this.env);
    const tools = toolsByName(definition.tools);
    const system: ChatMessage = {
      role: "system",
      content: definition.systemPrompt({
        repo,
        projectName: project?.name ?? projectId,
        memories: await projectMemories(this.env.DB, projectId),
      }),
    };

    for (let step = 1; step <= MAX_STEPS; step += 1) {
      await emit(this.env, { ...base, type: "thinking", data: { step } });

      let result;
      try {
        result = await router.chat(definition.modelAlias, {
          messages: [system, ...this.recent(HISTORY_LIMIT)],
          tools: tools.map((tool) => tool.spec),
          temperature: 0.3,
          maxTokens: 8192,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        await emit(this.env, { ...base, type: "error", data: { step, message } });
        return { reply: `Das Modell hat nicht geantwortet: ${message}` };
      }

      await emit(this.env, {
        ...base,
        type: "model_result",
        data: { step, model: `${result.target.provider}/${result.target.model}`, attempts: result.attempts },
        tokensIn: result.usage.inputTokens,
        tokensOut: result.usage.outputTokens,
        costUsd: result.costUsd,
      });

      this.append(result.message);
      const calls = result.message.toolCalls ?? [];
      if (!calls.length) {
        const reply = result.message.content?.trim() || "(keine Antwort)";
        await emit(this.env, { ...base, type: "message", data: { text: reply } });
        return { reply };
      }

      for (const call of calls) {
        const output = await this.runTool(call, definition.tools, context);
        this.append({ role: "tool", toolCallId: call.id, content: output.slice(0, TOOL_RESULT_CHARS) });
      }
    }

    const reply = `Ich habe nach ${MAX_STEPS} Schritten angehalten, damit nichts aus dem Ruder läuft. Sag mir, ob ich weitermachen soll.`;
    await emit(this.env, { ...base, type: "message", data: { text: reply } });
    return { reply };
  }

  private async runTool(call: ToolCall, allowed: readonly string[], context: ToolContext): Promise<string> {
    const base = { agentId: context.agentId, projectId: context.projectId };
    const tool = allowed.includes(call.name) ? toolByName(call.name) : undefined;
    let args: Record<string, unknown> = {};
    try {
      args = JSON.parse(call.arguments || "{}") as Record<string, unknown>;
    } catch {
      return JSON.stringify({ error: "Argumente sind kein gültiges JSON." });
    }
    await emit(this.env, { ...base, type: "tool_call", data: { tool: call.name, args: preview(args) } });
    if (!tool) return JSON.stringify({ error: `Werkzeug "${call.name}" steht dir nicht zur Verfügung.` });

    if (tool.requiresApproval) {
      const approvalId = crypto.randomUUID();
      await this.env.DB.prepare("INSERT INTO approvals (id, agent_id, action, details) VALUES (?, ?, ?, ?)")
        .bind(approvalId, context.agentId, call.name, JSON.stringify({ args, projectId: context.projectId, repo: context.repo }))
        .run();
      await emit(this.env, {
        ...base,
        type: "approval_requested",
        data: { approvalId, tool: call.name, summary: summarize(call.name, args) },
      });
      return JSON.stringify({
        status: "pending_approval",
        approvalId,
        note: "Ugur entscheidet über diese Aktion. Führe sie nicht erneut aus; sag ihm kurz, was du vorschlägst, und warte.",
      });
    }

    try {
      const result = await tool.run(args, context);
      await emit(this.env, { ...base, type: "tool_result", data: { tool: call.name, ok: true, preview: preview(result) } });
      return JSON.stringify(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await emit(this.env, { ...base, type: "tool_result", data: { tool: call.name, ok: false, preview: message } });
      return JSON.stringify({ error: message });
    }
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

function summarize(tool: string, args: Record<string, unknown>): string {
  if (tool === "repo_commit_files") {
    const files = Array.isArray(args.files) ? (args.files as { path?: string; delete?: boolean }[]) : [];
    return `Commit auf ${String(args.branch)}: „${String(args.message)}“ – ${files
      .map((file) => `${file.delete ? "löschen" : "schreiben"} ${file.path ?? "?"}`)
      .join(", ")}`;
  }
  if (tool === "repo_open_pull_request") return `Pull Request von ${String(args.branch)}: „${String(args.title)}“`;
  return preview(args);
}
