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
  /** A model chosen in the portal for this thread; tried first, the alias chain stays as fallback. */
  pinned?: PinnedModel;
}

export interface PinnedModel {
  provider: string;
  model: string;
}

export interface CatalogEntry {
  id: string;
  label: string;
  shortLabel: string;
  /** False while the provider's key is missing; the portal shows it greyed out. */
  available: boolean;
  models: { id: string; label: string; note?: string; inputUsdPerM: number; outputUsdPerM: number }[];
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

  /** Providers and their offered models, for the portal's picker. */
  catalog(): { providers: CatalogEntry[]; aliases: Record<string, ModelTarget[]> } {
    const providers = Object.entries(this.config.providers).map(([id, provider]) => ({
      id,
      label: provider.label ?? id,
      shortLabel: provider.shortLabel ?? provider.label ?? id,
      available: this.hasCredentials(id),
      models: (provider.models ?? []).map(({ id: model, label, note, inputUsdPerM, outputUsdPerM }) => ({ id: model, label, note, inputUsdPerM, outputUsdPerM })),
    }));
    return { providers, aliases: this.config.aliases };
  }

  /** The fallback chain of an alias with the state of each provider, for the configuration view. */
  chain(alias: string): { provider: string; providerLabel: string; model: string; available: boolean }[] {
    return (this.config.aliases[alias] ?? []).map((target) => ({
      provider: target.provider,
      providerLabel: this.config.providers[target.provider]?.label ?? target.provider,
      model: target.model,
      available: this.hasCredentials(target.provider),
    }));
  }

  /** True when the provider exists and offers this model in the catalog. */
  offers(pinned: PinnedModel): boolean {
    return Boolean(this.config.providers[pinned.provider]?.models?.some((model) => model.id === pinned.model));
  }

  async chat(alias: string, request: Omit<ChatRequest, "model">, options: RouteOptions = {}): Promise<RoutedResult> {
    const chain = this.config.aliases[alias] ?? [];
    const targets = options.pinned ? [this.pinnedTarget(options.pinned), ...chain.filter((target) => !(target.provider === options.pinned?.provider && target.model === options.pinned?.model))] : chain;
    if (!targets.length) throw new ModelError(`Unknown model alias "${alias}"`, "router", 400);

    const attempts: string[] = [];
    let lastError: unknown;
    for (const target of targets) {
      const port = this.hasCredentials(target.provider) ? this.port(target.provider, target.model) : undefined;
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

  private pinnedTarget(pinned: PinnedModel): ModelTarget {
    const entry = this.config.providers[pinned.provider]?.models?.find((model) => model.id === pinned.model);
    return { ...pinned, inputUsdPerM: entry?.inputUsdPerM ?? 0, outputUsdPerM: entry?.outputUsdPerM ?? 0 };
  }

  private hasCredentials(providerId: string): boolean {
    const provider = this.config.providers[providerId];
    if (!provider) return false;
    if (provider.enabledVar && secret(this.env, provider.enabledVar) !== "true") return false;
    return provider.kind === "workers-ai" || !provider.apiKeySecret || Boolean(secret(this.env, provider.apiKeySecret));
  }

  private port(providerId: string, model?: string): ModelPort | undefined {
    const provider: ProviderConfig | undefined = this.config.providers[providerId];
    if (!provider) return undefined;
    if (provider.kind === "workers-ai") return new WorkersAiModel(this.env.AI);

    // A model with its own endpoint (Modal) is called there directly, never through the gateway.
    const ownUrl = provider.models?.find((entry) => entry.id === model)?.baseUrl;
    const viaGateway = !ownUrl && this.env.MODEL_VIA_GATEWAY === "true" && provider.gatewayPath && this.env.CF_ACCOUNT_ID;
    const baseUrl = ownUrl ?? (viaGateway
      ? `https://gateway.ai.cloudflare.com/v1/${this.env.CF_ACCOUNT_ID}/${this.env.AI_GATEWAY_ID}/${provider.gatewayPath}`
      : provider.baseUrl);
    if (!baseUrl) return undefined;
    const apiKey = provider.apiKeySecret ? secret(this.env, provider.apiKeySecret) : undefined;
    return new OpenAICompatibleModel(providerId, baseUrl, apiKey);
  }
}
