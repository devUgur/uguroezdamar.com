import type { ChatMessage, ChatRequest, ChatResult, ModelPort, ToolCall, Usage } from "./port.ts";
import { ModelError } from "./port.ts";

interface WireToolCall {
  index?: number;
  id?: string;
  type?: string;
  function?: { name?: string; arguments?: string | Record<string, unknown> };
}

interface WireMessage {
  role?: string;
  content?: string | null;
  tool_calls?: WireToolCall[];
}

interface WireUsage {
  prompt_tokens?: number;
  completion_tokens?: number;
  /** OpenAI and most compatible providers. */
  prompt_tokens_details?: { cached_tokens?: number };
  /** DeepSeek. */
  prompt_cache_hit_tokens?: number;
}

interface WireResponse {
  choices?: { message?: WireMessage }[];
  usage?: WireUsage;
}

interface WireChunk {
  choices?: { delta?: WireMessage }[];
  usage?: WireUsage;
}

/**
 * Adapter for every provider that speaks the OpenAI chat-completions format: Gemini (Google AI
 * Studio), OpenRouter, DeepSeek, OpenAI, and the Cloudflare AI Gateway in front of any of them.
 */
export class OpenAICompatibleModel implements ModelPort {
  readonly external = true;

  constructor(
    readonly provider: string,
    private readonly baseUrl: string,
    private readonly apiKey: string | undefined,
    private readonly extraHeaders: Record<string, string> = {},
    private readonly options: { shortToolCallIds?: boolean; reasoningEffort?: boolean } = {},
  ) {}

  available(): boolean {
    return Boolean(this.apiKey);
  }

  async chat(request: ChatRequest, onDelta?: (text: string) => void): Promise<ChatResult> {
    if (onDelta) {
      try {
        return await this.send(request, onDelta);
      } catch (error) {
        // A provider that rejects streaming gets one plain retry; other errors go to the router.
        if (!(error instanceof ModelError) || error.status !== 400) throw error;
      }
    }
    return this.send(request);
  }

  private async send(request: ChatRequest, onDelta?: (text: string) => void): Promise<ChatResult> {
    const body = {
      model: request.model,
      messages: request.messages.map((message) => toWire(message, this.options.shortToolCallIds ? shortId : undefined)),
      tools: request.tools?.length ? request.tools.map((tool) => ({ type: "function", function: tool })) : undefined,
      temperature: request.temperature,
      max_tokens: request.maxTokens,
      reasoning_effort: this.options.reasoningEffort && request.effort ? request.effort : undefined,
      stream: onDelta ? true : undefined,
      // Without it most providers send no token counts in a stream, and the ledger would record zero.
      stream_options: onDelta ? { include_usage: true } : undefined,
    };

    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${this.apiKey ?? ""}`,
        ...this.extraHeaders,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw new ModelError(`${this.provider} ${response.status}: ${(await response.text()).slice(0, 500)}`, this.provider, response.status);
    }
    if (onDelta && response.body && (response.headers.get("content-type") ?? "").includes("text/event-stream")) {
      return readStream(response.body, onDelta, this.provider);
    }

    const data = JSON.parse(await response.text()) as WireResponse;
    const message = data.choices?.[0]?.message;
    if (!message) throw new ModelError(`${this.provider}: response without a message`, this.provider);
    return { message: fromWire(message), usage: usageOf(data.usage) };
  }
}

function usageOf(usage: WireUsage | undefined): Usage {
  return {
    inputTokens: usage?.prompt_tokens ?? 0,
    outputTokens: usage?.completion_tokens ?? 0,
    cacheReadTokens: usage?.prompt_tokens_details?.cached_tokens ?? usage?.prompt_cache_hit_tokens ?? 0,
  };
}

/** Reads a server-sent-events stream and assembles text and tool calls from the deltas. */
async function readStream(body: ReadableStream<Uint8Array>, onDelta: (text: string) => void, provider: string): Promise<ChatResult> {
  const reader = body.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = "";
  let content = "";
  let usage: Usage = { inputTokens: 0, outputTokens: 0 };
  const calls = new Map<number, { id?: string; name: string; arguments: string }>();

  const handle = (line: string) => {
    if (!line.startsWith("data:")) return;
    const payload = line.slice(5).trim();
    if (!payload || payload === "[DONE]") return;
    let chunk: WireChunk;
    try {
      chunk = JSON.parse(payload) as WireChunk;
    } catch {
      return;
    }
    if (chunk.usage) usage = usageOf(chunk.usage);
    const delta = chunk.choices?.[0]?.delta;
    if (!delta) return;
    if (delta.content) {
      content += delta.content;
      onDelta(delta.content);
    }
    for (const [position, call] of (delta.tool_calls ?? []).entries()) {
      const index = call.index ?? position;
      const current = calls.get(index) ?? { name: "", arguments: "" };
      if (call.id) current.id = call.id;
      if (call.function?.name) current.name += call.function.name;
      const args = call.function?.arguments;
      if (args !== undefined) current.arguments += typeof args === "string" ? args : JSON.stringify(args);
      calls.set(index, current);
    }
  };

  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += value;
    const lines = buffer.split(/\r?\n/);
    buffer = lines.pop() ?? "";
    lines.forEach(handle);
  }
  if (buffer) handle(buffer);

  const toolCalls: ToolCall[] = [...calls.entries()]
    .sort(([a], [b]) => a - b)
    .filter(([, call]) => call.name)
    .map(([index, call]) => ({ id: call.id ?? `call_${Date.now()}_${index}`, name: call.name, arguments: call.arguments || "{}" }));
  if (!content && !toolCalls.length) throw new ModelError(`${provider}: empty stream`, provider);
  return {
    message: { role: "assistant", content: content || null, toolCalls: toolCalls.length ? toolCalls : undefined },
    usage,
  };
}

/**
 * Mistral models reject any tool-call id that is not exactly nine letters or digits. The mapping is a
 * pure function of the id, so a call and its result still match, and stored history stays unchanged.
 */
export function shortId(id: string): string {
  let a = 0x811c9dc5;
  let b = 0x01000193;
  for (const char of id) {
    a = Math.imul(a ^ char.charCodeAt(0), 0x01000193) >>> 0;
    b = Math.imul(b + char.charCodeAt(0), 0x85ebca6b) >>> 0;
  }
  return (a.toString(36).padStart(7, "0") + b.toString(36)).slice(0, 9).padEnd(9, "0");
}

function toWire(message: ChatMessage, mapId: (id: string) => string = (id) => id): Record<string, unknown> {
  if (message.role === "tool") {
    return { role: "tool", tool_call_id: message.toolCallId ? mapId(message.toolCallId) : message.toolCallId, content: message.content ?? "" };
  }
  const wire: Record<string, unknown> = { role: message.role, content: message.content ?? "" };
  if (message.toolCalls?.length) {
    wire.tool_calls = message.toolCalls.map((call) => ({
      id: mapId(call.id),
      type: "function",
      function: { name: call.name, arguments: call.arguments },
    }));
  }
  return wire;
}

export function fromWire(message: WireMessage): ChatMessage {
  const toolCalls: ToolCall[] = (message.tool_calls ?? [])
    .filter((call) => call.function?.name)
    .map((call, index) => ({
      id: call.id ?? `call_${Date.now()}_${index}`,
      name: call.function?.name ?? "",
      arguments:
        typeof call.function?.arguments === "string" ? call.function.arguments : JSON.stringify(call.function?.arguments ?? {}),
    }));
  return {
    role: "assistant",
    content: message.content ?? null,
    toolCalls: toolCalls.length ? toolCalls : undefined,
  };
}
