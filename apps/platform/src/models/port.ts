/**
 * ModelPort: the only way agents reach a language model. Providers are adapters behind it;
 * which provider and model serve an alias is configuration (models/config.ts), not code.
 */
export type Role = "system" | "user" | "assistant" | "tool";

export interface ToolCall {
  id: string;
  name: string;
  /** JSON-encoded arguments, as the model produced them. */
  arguments: string;
}

export interface ChatMessage {
  role: Role;
  content: string | null;
  toolCalls?: ToolCall[];
  toolCallId?: string;
}

export interface ToolSpec {
  name: string;
  description: string;
  /** JSON Schema of the arguments object. */
  parameters: Record<string, unknown>;
}

export interface ChatRequest {
  model: string;
  messages: ChatMessage[];
  tools?: ToolSpec[];
  temperature?: number;
  maxTokens?: number;
}

export interface Usage {
  inputTokens: number;
  outputTokens: number;
}

export interface ChatResult {
  message: ChatMessage;
  usage: Usage;
}

export interface ModelPort {
  readonly provider: string;
  /** False when the provider's credentials are missing; the router then skips it. */
  available(): boolean;
  chat(request: ChatRequest): Promise<ChatResult>;
}

export class ModelError extends Error {
  constructor(
    message: string,
    readonly provider: string,
    readonly status?: number,
  ) {
    super(message);
  }

  /** Rate limits, outages and timeouts are worth a fallback; a malformed request is not. */
  get retryable(): boolean {
    return this.status === undefined || this.status === 408 || this.status === 429 || this.status >= 500;
  }
}
