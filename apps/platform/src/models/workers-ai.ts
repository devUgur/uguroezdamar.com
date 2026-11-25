import type { ChatRequest, ChatResult, ModelPort, ToolCall } from "./port.ts";
import { ModelError } from "./port.ts";

interface WorkersAiOutput {
  response?: string | null;
  tool_calls?: { id?: string; name?: string; arguments?: unknown; function?: { name?: string; arguments?: unknown } }[];
  usage?: { prompt_tokens?: number; completion_tokens?: number };
}

/** Adapter for models hosted on Cloudflare Workers AI (free daily allocation, no API key). */
export class WorkersAiModel implements ModelPort {
  readonly provider = "workers-ai";
  readonly external = false;

  constructor(private readonly ai: Ai) {}

  available(): boolean {
    return true;
  }

  async chat(request: ChatRequest): Promise<ChatResult> {
    const messages = request.messages.map((message) => {
      if (message.role === "tool") {
        return { role: "tool", tool_call_id: message.toolCallId, content: message.content ?? "" };
      }
      if (message.toolCalls?.length) {
        return {
          role: "assistant",
          content: message.content ?? "",
          tool_calls: message.toolCalls.map((call) => ({
            id: call.id,
            type: "function",
            function: { name: call.name, arguments: call.arguments },
          })),
        };
      }
      return { role: message.role, content: message.content ?? "" };
    });

    let output: WorkersAiOutput;
    try {
      output = (await this.ai.run(request.model as keyof AiModels, {
        messages,
        tools: request.tools?.map((tool) => ({ type: "function", function: tool })),
        max_tokens: request.maxTokens,
        temperature: request.temperature,
      } as never)) as WorkersAiOutput;
    } catch (error) {
      throw new ModelError(`workers-ai: ${String(error)}`, this.provider);
    }

    const toolCalls: ToolCall[] = (output.tool_calls ?? [])
      .map((call, index) => {
        const name = call.function?.name ?? call.name ?? "";
        const args = call.function?.arguments ?? call.arguments ?? {};
        return {
          id: call.id ?? `call_${Date.now()}_${index}`,
          name,
          arguments: typeof args === "string" ? args : JSON.stringify(args),
        };
      })
      .filter((call) => call.name);

    return {
      message: {
        role: "assistant",
        content: output.response ?? null,
        toolCalls: toolCalls.length ? toolCalls : undefined,
      },
      usage: {
        inputTokens: output.usage?.prompt_tokens ?? 0,
        outputTokens: output.usage?.completion_tokens ?? 0,
      },
    };
  }
}
