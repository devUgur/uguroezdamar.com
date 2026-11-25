import type { Env } from "../env.ts";
import { secret } from "../env.ts";
import type { ModelConfig, ModelTarget, ProviderConfig } from "./config.ts";
import { DEFAULT_MODEL_CONFIG } from "./config.ts";
import { OpenAICompatibleModel } from "./openai-compatible.ts";
import type { ChatRequest, ChatResult, ModelPort } from "./port.ts";
import { ModelError } from "./port.ts";
import { WorkersAiModel } from "./workers-ai.ts";
import type { SubrequestBudget } from "../runtime/budget.ts";

export interface RouteOptions {
  /** Each external attempt takes one subrequest; without a budget nothing is counted. */
  budget?: SubrequestBudget;
  onDelta?: (text: string) => void;
}

export interface RoutedResult extends ChatResult {
  target: ModelTarget;
  costUsd: number;
  attempts: string[];
}

/** Resolves an alias to providers and falls back along the configured chain. */
export class ModelRouter {
  private constructor(
    private readonly env: Env,
    private readonly config: ModelConfig,
  ) {}

  static async load(env: Env): Promise<ModelRouter> {
    const override = await env.CONFIG.get<Partial<ModelConfig>>("models", "json").catch(() => null);
    const config: ModelConfig = {
      providers: { ...DEFAULT_MODEL_CONFIG.providers, ...override?.providers },
      aliases: { ...DEFAULT_MODEL_CONFIG.aliases, ...override?.aliases },
    };
    return new ModelRouter(env, config);
  }

  async chat(alias: string, request: Omit<ChatRequest, "model">, options: RouteOptions = {}): Promise<RoutedResult> {
    const targets = this.config.aliases[alias];
    if (!targets?.length) throw new ModelError(`Unknown model alias "${alias}"`, "router", 400);

    const attempts: string[] = [];
    let lastError: unknown;
    for (const target of targets) {
      const port = this.port(target.provider);
      if (!port?.available()) {
        attempts.push(`${target.provider}/${target.model}: skipped (no credentials)`);
        continue;
      }
      if (port.external) options.budget?.take();
      try {
        const result = await port.chat({ ...request, model: target.model }, options.onDelta);
        attempts.push(`${target.provider}/${target.model}: ok`);
        const costUsd =
          (result.usage.inputTokens * target.inputUsdPerM + result.usage.outputTokens * target.outputUsdPerM) / 1_000_000;
        return { ...result, target, costUsd, attempts };
      } catch (error) {
        lastError = error;
        attempts.push(`${target.provider}/${target.model}: ${error instanceof Error ? error.message.slice(0, 200) : String(error)}`);
        if (error instanceof ModelError && !error.retryable) break;
      }
    }
    throw new ModelError(`All models for "${alias}" failed. ${attempts.join(" | ")}`, "router", lastError instanceof ModelError ? lastError.status : undefined);
  }

  private port(providerId: string): ModelPort | undefined {
    const provider: ProviderConfig | undefined = this.config.providers[providerId];
    if (!provider) return undefined;
    if (provider.kind === "workers-ai") return new WorkersAiModel(this.env.AI);

    const viaGateway = this.env.MODEL_VIA_GATEWAY === "true" && provider.gatewayPath && this.env.CF_ACCOUNT_ID;
    const baseUrl = viaGateway
      ? `https://gateway.ai.cloudflare.com/v1/${this.env.CF_ACCOUNT_ID}/${this.env.AI_GATEWAY_ID}/${provider.gatewayPath}`
      : provider.baseUrl;
    if (!baseUrl) return undefined;
    const apiKey = provider.apiKeySecret ? secret(this.env, provider.apiKeySecret) : undefined;
    return new OpenAICompatibleModel(providerId, baseUrl, apiKey);
  }
}
