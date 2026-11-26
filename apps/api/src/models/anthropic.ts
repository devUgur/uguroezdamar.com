import Anthropic from "@anthropic-ai/sdk";
import type { ChatMessage, ChatRequest, ChatResult, ModelPort, ToolCall } from "./port.ts";
import { ModelError } from "./port.ts";

type MessageParam = Anthropic.Beta.Messages.BetaMessageParam;
type ContentBlockParam = Anthropic.Beta.Messages.BetaContentBlockParam;
type ToolResult = Anthropic.Beta.Messages.BetaToolResultBlockParam;

export const ANTHROPIC = "anthropic";
const MAX_TOKENS = 32_000;
/** Models whose refusals the API can re-run on another model inside the same call. Haiku has no server-side fallback. */
const FALLBACK_MODELS = /^claude-(opus|sonnet|fable)-/;

/**
 * Native adapter for Claude (Messages API, official SDK). Native rather than OpenAI-compatible because
 * thinking blocks must go back unchanged on the next turn, tools use Anthropic's own shape, and prompt
 * caching and server-side refusal fallbacks only exist here.
 */
export class AnthropicModel implements ModelPort {
  readonly provider = ANTHROPIC;
  readonly external = true;
  private readonly client: Anthropic | undefined;

  constructor(apiKey: string | undefined, baseURL?: string) {
    // The router counts and retries; the SDK must not retry on its own.
    this.client = apiKey ? new Anthropic({ apiKey, baseURL, maxRetries: 0, timeout: 90_000 }) : undefined;
  }

  available(): boolean {
    return Boolean(this.client);
  }

  async chat(request: ChatRequest, onDelta?: (text: string) => void): Promise<ChatResult> {
    if (!this.client) throw new ModelError("anthropic: kein Schlüssel", ANTHROPIC, 401);
    const { system, messages } = toAnthropic(request.messages);
    const fallback = FALLBACK_MODELS.test(request.model);
    let message: Anthropic.Beta.Messages.BetaMessage;
    try {
      const stream = this.client.beta.messages.stream({
        model: request.model,
        max_tokens: request.maxTokens && request.maxTokens > MAX_TOKENS ? request.maxTokens : MAX_TOKENS,
        // Agentic coding with many tool calls: medium is the recommended starting point unless the agent says otherwise.
        output_config: { effort: request.effort ?? "medium" },
        // Caches the stable prefix (tools, system prompt, history) between the steps of a run.
        cache_control: { type: "ephemeral" },
        system: system || undefined,
        messages,
        tools: request.tools?.map((tool) => ({
          name: tool.name,
          description: tool.description,
          input_schema: tool.parameters as Anthropic.Beta.Messages.BetaTool.InputSchema,
        })),
        ...(fallback ? { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const } : {}),
      });
      if (onDelta) stream.on("text", (text) => onDelta(text));
      message = await stream.finalMessage();
    } catch (error) {
      if (error instanceof Anthropic.APIError) {
        throw new ModelError(`anthropic ${error.status ?? ""}: ${error.message.slice(0, 400)}`, ANTHROPIC, error.status);
      }
      throw new ModelError(`anthropic: ${error instanceof Error ? error.message : String(error)}`, ANTHROPIC);
    }
    return fromAnthropic(message);
  }
}

/** Text of the answer, tool calls, and the full content for the next turn. */
export function fromAnthropic(message: Anthropic.Beta.Messages.BetaMessage): ChatResult {
  const text = message.content
    .filter((block): block is Anthropic.Beta.Messages.BetaTextBlock => block.type === "text")
    .map((block) => block.text)
    .join("");
  // A tool input cut off at the token limit can look valid; never run it.
  const truncated = message.stop_reason === "max_tokens";
  const toolCalls: ToolCall[] = truncated
    ? []
    : message.content
        .filter((block): block is Anthropic.Beta.Messages.BetaToolUseBlock => block.type === "tool_use")
        .map((block) => ({ id: block.id, name: block.name, arguments: JSON.stringify(block.input ?? {}) }));
  let content = text || null;
  if (message.stop_reason === "refusal") content = `${text}\n\n(Das Modell hat diese Anfrage abgelehnt.)`.trim();
  else if (truncated) content = `${text}\n\n(Die Antwort wurde am Token-Limit abgeschnitten.)`.trim();
  const usage = message.usage;
  return {
    message: {
      role: "assistant",
      content,
      toolCalls: toolCalls.length ? toolCalls : undefined,
      raw: truncated || message.stop_reason === "refusal" ? undefined : { provider: ANTHROPIC, content: message.content },
    },
    usage: {
      inputTokens: (usage.input_tokens ?? 0) + (usage.cache_creation_input_tokens ?? 0) + (usage.cache_read_input_tokens ?? 0),
      outputTokens: usage.output_tokens ?? 0,
      cacheReadTokens: usage.cache_read_input_tokens ?? 0,
      cacheWriteTokens: usage.cache_creation_input_tokens ?? 0,
    },
  };
}

/**
 * Turns the shared history into the Messages API shape: the system prompt goes to the top level, consecutive
 * tool results become one user turn of tool_result blocks, and Claude's own earlier turns are replayed as returned.
 */
export function toAnthropic(history: ChatMessage[]): { system: string; messages: MessageParam[] } {
  const system = history
    .filter((message) => message.role === "system")
    .map((message) => message.content ?? "")
    .join("\n\n");
  const messages: MessageParam[] = [];
  const knownCalls = new Set<string>();

  const push = (role: "user" | "assistant", blocks: ContentBlockParam[]) => {
    if (!blocks.length) return;
    const last = messages.at(-1);
    if (last && last.role === role && Array.isArray(last.content)) last.content.push(...blocks);
    else messages.push({ role, content: blocks });
  };

  for (const message of history) {
    if (message.role === "system") continue;
    if (message.role === "tool") {
      // A result whose call is not in the window would be rejected; it is dropped with its call.
      if (!message.toolCallId || !knownCalls.has(message.toolCallId)) continue;
      const result: ToolResult = { type: "tool_result", tool_use_id: message.toolCallId, content: message.content ?? "" };
      push("user", [result]);
      continue;
    }
    if (message.role === "assistant") {
      const blocks =
        message.raw?.provider === ANTHROPIC && Array.isArray(message.raw.content)
          ? (message.raw.content as ContentBlockParam[])
          : assistantBlocks(message);
      for (const block of blocks) if (block.type === "tool_use") knownCalls.add(block.id);
      push("assistant", blocks);
      continue;
    }
    if (message.content) push("user", [{ type: "text", text: message.content }]);
  }
  // The conversation must start with the user and every tool_use must be answered before the next user text.
  while (messages[0]?.role === "assistant") messages.shift();
  return { system, messages };
}

function assistantBlocks(message: ChatMessage): ContentBlockParam[] {
  const blocks: ContentBlockParam[] = [];
  if (message.content) blocks.push({ type: "text", text: message.content });
  for (const call of message.toolCalls ?? []) {
    let input: unknown = {};
    try {
      input = JSON.parse(call.arguments || "{}");
    } catch {
      input = {};
    }
    blocks.push({ type: "tool_use", id: call.id, name: call.name, input: input as Record<string, unknown> });
  }
  return blocks;
}
