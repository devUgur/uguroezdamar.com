import type { ChatMessage, ChatRequest, ChatResult, ModelPort, ToolCall } from "./port.ts";
import { ModelError } from "./port.ts";

interface WireToolCall {
  id?: string;
  type?: string;
  function?: { name?: string; arguments?: string | Record<string, unknown> };
}

interface WireMessage {
  role?: string;
  content?: string | null;
  tool_calls?: WireToolCall[];
}

interface WireResponse {
  choices?: { message?: WireMessage }[];
  usage?: { prompt_tokens?: number; completion_tokens?: number };
  error?: { message?: string } | string;
}

/**
 * Adapter for every provider that speaks the OpenAI chat-completions format: Gemini (Google AI
 * Studio), OpenRouter, DeepSeek, OpenAI, and the Cloudflare AI Gateway in front of any of them.
 */
export class OpenAICompatibleModel implements ModelPort {
  constructor(
    readonly provider: string,
    private readonly baseUrl: string,
    private readonly apiKey: string | undefined,
    private readonly extraHeaders: Record<string, string> = {},
  ) {}

  available(): boolean {
    return Boolean(this.apiKey);
  }

  async chat(request: ChatRequest): Promise<ChatResult> {
    const body = {
      model: request.model,
      messages: request.messages.map(toWire),
      tools: request.tools?.length
        ? request.tools.map((tool) => ({ type: "function", function: tool }))
        : undefined,
      temperature: request.temperature,
      max_tokens: request.maxTokens,
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

    const text = await response.text();
    if (!response.ok) {
      throw new ModelError(`${this.provider} ${response.status}: ${text.slice(0, 500)}`, this.provider, response.status);
    }

    const data = JSON.parse(text) as WireResponse;
    const message = data.choices?.[0]?.message;
    if (!message) throw new ModelError(`${this.provider}: response without a message`, this.provider);

    return {
      message: fromWire(message),
      usage: {
        inputTokens: data.usage?.prompt_tokens ?? 0,
        outputTokens: data.usage?.completion_tokens ?? 0,
      },
    };
  }
}

function toWire(message: ChatMessage): Record<string, unknown> {
  if (message.role === "tool") {
    return { role: "tool", tool_call_id: message.toolCallId, content: message.content ?? "" };
  }
  const wire: Record<string, unknown> = { role: message.role, content: message.content ?? "" };
  if (message.toolCalls?.length) {
    wire.tool_calls = message.toolCalls.map((call) => ({
      id: call.id,
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
        typeof call.function?.arguments === "string"
          ? call.function.arguments
          : JSON.stringify(call.function?.arguments ?? {}),
    }));
  return {
    role: "assistant",
    content: message.content ?? null,
    toolCalls: toolCalls.length ? toolCalls : undefined,
  };
}
