import type { Env } from "../env.ts";
import { secret } from "../env.ts";
import { OWNER_TENANT } from "../tenancy.ts";
import { AnthropicModel } from "./anthropic.ts";
import type { CatalogModel, ModelConfig, ModelTarget, ProviderConfig } from "./config.ts";
import { DEFAULT_MODEL_CONFIG, DEFAULT_PAID_PRICE } from "./config.ts";
import { listModelDefaults, loadTenantKeys, type ModelDefault, type TenantKey } from "./credentials.ts";
import { OpenAICompatibleModel } from "./openai-compatible.ts";
import type { ChatRequest, ChatResult, ModelPort } from "./port.ts";
import { ModelError } from "./port.ts";
import { WorkersAiModel } from "./workers-ai.ts";
import type { SubrequestBudget } from "../runtime/budget.ts";

/** Marker in the attempts of a run: the target was left out because the content is private. The portal reads it. */
export const PRIVATE_BLOCK = "gesperrt (strenge Datenrichtlinie, Anbieter wertet Daten aus)";

export interface RouteOptions {
  /** Each external attempt takes one subrequest; without a budget nothing is counted. */
  budget?: SubrequestBudget;
  onDelta?: (text: string) => void;
  /** Only providers that never train on content: set for private repositories. */
  privateContent?: boolean;
  /** A model chosen in the portal for this thread; tried first, the alias chain stays as fallback. */
  pinned?: PinnedModel;
}

export interface PinnedModel {
  provider: string;
  model: string;
}

/** Where a provider's key comes from: entered in the portal, a Worker secret of the owner, none needed, or missing. */
export type KeySource = "tenant" | "environment" | "builtin" | "none";

export interface CatalogEntry {
  id: string;
  label: string;
  shortLabel: string;
  kind: ProviderConfig["kind"];
  description: string | null;
  keyUrl: string | null;
  /** False while the provider's key is missing; the portal shows it greyed out. */
  available: boolean;
  keySource: KeySource;
  /** True when the provider may train on prompts; such models are blocked for private repositories. */
  trainsOnData: boolean;
  paid: boolean;
  /** A provider the tenant added itself (OpenAI-compatible base URL). */
  custom: boolean;
  canDiscover: boolean;
  models: { id: string; label: string; note?: string; inputUsdPerM: number | null; outputUsdPerM: number | null; discovered?: boolean }[];
}

export interface RoutedResult extends ChatResult {
  target: ModelTarget;
  costUsd: number;
  attempts: string[];
}

/** Resolves an alias to providers and falls back along the configured chain, with the tenant's own keys and choices. */
export class ModelRouter {
  private constructor(
    private readonly env: Env,
    private readonly config: ModelConfig,
    private readonly tenantId: string,
    private readonly keys: Map<string, TenantKey>,
    private readonly defaults: ModelDefault[],
  ) {}

  static async load(env: Env, tenantId: string = OWNER_TENANT): Promise<ModelRouter> {
    const [override, keys, defaults] = await Promise.all([
      env.CONFIG.get<Partial<ModelConfig>>("models", "json").catch(() => null),
      loadTenantKeys(env, tenantId).catch((error) => {
        console.error("provider keys unavailable", error instanceof Error ? error.message : error);
        return new Map<string, TenantKey>();
      }),
      listModelDefaults(env, tenantId).catch(() => [] as ModelDefault[]),
    ]);
    return new ModelRouter(env, mergeConfig(override, keys), tenantId, keys, defaults);
  }

  /** Providers and their offered models, for the portal's picker and the key settings. */
  catalog(): { providers: CatalogEntry[]; aliases: Record<string, ModelTarget[]>; defaults: ModelDefault[] } {
    const providers = Object.entries(this.config.providers).map(([id, provider]): CatalogEntry => {
      const curated = new Set((DEFAULT_MODEL_CONFIG.providers[id]?.models ?? []).map((model) => model.id));
      return {
        id,
        label: provider.label ?? id,
        shortLabel: provider.shortLabel ?? provider.label ?? id,
        kind: provider.kind,
        description: provider.description ?? null,
        keyUrl: provider.keyUrl ?? null,
        available: this.hasCredentials(id),
        keySource: this.keySource(id),
        trainsOnData: provider.trainsOnData !== false,
        paid: provider.paid === true,
        custom: !DEFAULT_MODEL_CONFIG.providers[id],
        canDiscover: provider.discoverModels === true,
        models: (provider.models ?? []).map(({ id: model, label, note, inputUsdPerM, outputUsdPerM }) => ({
          id: model,
          label,
          note,
          inputUsdPerM: inputUsdPerM ?? null,
          outputUsdPerM: outputUsdPerM ?? null,
          discovered: curated.has(model) ? undefined : true,
        })),
      };
    });
    return { providers, aliases: this.config.aliases, defaults: this.defaults };
  }

  /** The fallback chain of an alias with the state of each provider, for the configuration view. */
  chain(alias: string): { provider: string; providerLabel: string; model: string; available: boolean }[] {
    return this.ordered(alias).map((target) => ({
      provider: target.provider,
      providerLabel: this.config.providers[target.provider]?.label ?? target.provider,
      model: target.model,
      available: this.hasCredentials(target.provider),
    }));
  }

  /** True when the provider may evaluate prompts (or is unknown); such a provider never gets private content. */
  trainsOnData(providerId: string): boolean {
    return this.config.providers[providerId]?.trainsOnData !== false;
  }

  /** True when the pinned model's provider does not evaluate prompts (so private content may go to it). */
  keepsContentPrivate(pinned: PinnedModel): boolean {
    return this.offers(pinned) && this.config.providers[pinned.provider]?.trainsOnData === false;
  }

  /** True when the provider exists and offers this model in the catalog. */
  offers(pinned: PinnedModel): boolean {
    return Boolean(this.config.providers[pinned.provider]?.models?.some((model) => model.id === pinned.model));
  }

  /**
   * Starts the GPU behind a model that has its own endpoint (Modal) without waiting for it. A cold start
   * takes longer than the 100 s Cloudflare allows a request, so the first message would otherwise fail
   * and fall back to another provider. The request only needs to arrive; it is not awaited for long.
   */
  async warmUp(pinned: PinnedModel): Promise<void> {
    const provider = this.config.providers[pinned.provider];
    const baseUrl = provider?.models?.find((model) => model.id === pinned.model)?.baseUrl;
    if (!baseUrl || !this.hasCredentials(pinned.provider)) return;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 1500);
    try {
      await fetch(`${baseUrl.replace(/\/v1$/, "")}/health`, { signal: controller.signal });
    } catch {
      // Expected: the request is cut off on purpose while the container boots.
    } finally {
      clearTimeout(timer);
    }
  }

  async chat(alias: string, request: Omit<ChatRequest, "model">, options: RouteOptions = {}): Promise<RoutedResult> {
    const chain = this.ordered(alias);
    const ordered = options.pinned ? [this.target(options.pinned), ...chain.filter((target) => !sameTarget(target, options.pinned))] : chain;
    if (!ordered.length) throw new ModelError(`Unknown model alias "${alias}"`, "router", 400);
    const attempts: string[] = [];
    // Private content never reaches a provider that may evaluate it. Blocked targets are named, so a chosen model
    // that was left out does not look like a silent failure.
    const targets = options.privateContent ? ordered.filter((target) => !this.trainsOnData(target.provider)) : ordered;
    if (options.privateContent) {
      for (const target of ordered.filter((candidate) => this.trainsOnData(candidate.provider))) attempts.push(`${target.provider}/${target.model}: ${PRIVATE_BLOCK}`);
    }
    if (!targets.length) {
      throw new ModelError(`Dieses Projekt ist privat: Es darf nur ein Modell ohne Datenauswertung antworten (z. B. Claude, OpenAI, Workers AI oder Modal), und keines davon ist für diese Rolle eingetragen. ${attempts.join(" | ")}`, "router", 400);
    }

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
        const costUsd = (result.usage.inputTokens * target.inputUsdPerM + result.usage.outputTokens * target.outputUsdPerM) / 1_000_000;
        return { ...result, target, costUsd, attempts };
      } catch (error) {
        lastError = error;
        attempts.push(`${target.provider}/${target.model}: ${error instanceof Error ? error.message.slice(0, 200) : String(error)}`);
        if (error instanceof ModelError && !error.retryable) break;
      }
    }
    throw new ModelError(`All models for "${alias}" failed. ${attempts.join(" | ")}`, "router", lastError instanceof ModelError ? lastError.status : undefined);
  }

  /** The tenant's chosen model for this alias first, then the built-in chain. */
  private ordered(alias: string): ModelTarget[] {
    const chain = this.config.aliases[alias] ?? [];
    const chosen = this.defaults.find((entry) => entry.alias === alias);
    if (!chosen || !this.offers(chosen)) return chain;
    return [this.target(chosen), ...chain.filter((target) => !sameTarget(target, chosen))];
  }

  private target(pinned: PinnedModel): ModelTarget {
    const provider = this.config.providers[pinned.provider];
    const entry = provider?.models?.find((model) => model.id === pinned.model);
    return { provider: pinned.provider, model: pinned.model, ...priceOf(provider, entry) };
  }

  private keySource(providerId: string): KeySource {
    const provider = this.config.providers[providerId];
    if (!provider) return "none";
    if (provider.kind === "workers-ai" || !provider.apiKeySecret) return "builtin";
    if (this.keys.has(providerId)) return "tenant";
    // The owner's Worker secrets are the owner's bill: other tenants never use them.
    if (this.tenantId === OWNER_TENANT && secret(this.env, provider.apiKeySecret)) return "environment";
    return "none";
  }

  private apiKey(providerId: string): string | undefined {
    const provider = this.config.providers[providerId];
    if (!provider?.apiKeySecret) return undefined;
    return this.keys.get(providerId)?.apiKey ?? (this.tenantId === OWNER_TENANT ? secret(this.env, provider.apiKeySecret) : undefined);
  }

  private hasCredentials(providerId: string): boolean {
    const provider = this.config.providers[providerId];
    if (!provider) return false;
    if (provider.enabledVar && secret(this.env, provider.enabledVar) !== "true") return false;
    return this.keySource(providerId) !== "none";
  }

  private port(providerId: string, model?: string): ModelPort | undefined {
    const provider: ProviderConfig | undefined = this.config.providers[providerId];
    if (!provider) return undefined;
    if (provider.kind === "workers-ai") return new WorkersAiModel(this.env.AI);
    const apiKey = this.apiKey(providerId);
    if (provider.kind === "anthropic") return new AnthropicModel(apiKey);

    // A model with its own endpoint (Modal) is called there directly, never through the gateway.
    const ownUrl = provider.models?.find((entry) => entry.id === model)?.baseUrl;
    const viaGateway = !ownUrl && this.env.MODEL_VIA_GATEWAY === "true" && provider.gatewayPath && this.env.CF_ACCOUNT_ID;
    const baseUrl = ownUrl ?? (viaGateway
      ? `https://gateway.ai.cloudflare.com/v1/${this.env.CF_ACCOUNT_ID}/${this.env.AI_GATEWAY_ID}/${provider.gatewayPath}`
      : provider.baseUrl);
    if (!baseUrl) return undefined;
    const shortToolCallIds = provider.shortToolCallIds || provider.models?.find((entry) => entry.id === model)?.shortToolCallIds;
    return new OpenAICompatibleModel(providerId, baseUrl, apiKey, {}, { shortToolCallIds });
  }
}

function sameTarget(target: ModelTarget, other: PinnedModel | undefined): boolean {
  return Boolean(other) && target.provider === other?.provider && target.model === other?.model;
}

/** Known price, or for a paid provider the deliberately high default, so the daily budget also limits unknown models. */
export function priceOf(provider: ProviderConfig | undefined, model: CatalogModel | undefined): { inputUsdPerM: number; outputUsdPerM: number } {
  if (model?.inputUsdPerM !== undefined && model.outputUsdPerM !== undefined) return { inputUsdPerM: model.inputUsdPerM, outputUsdPerM: model.outputUsdPerM };
  return provider?.paid ? { ...DEFAULT_PAID_PRICE } : { inputUsdPerM: 0, outputUsdPerM: 0 };
}

/**
 * Built-in providers, the KV override, the tenant's own providers and the models its keys may use. Curated models
 * come first; models a key listed are added after them, so a key unlocks the provider's whole range.
 */
export function mergeConfig(override: Partial<ModelConfig> | null, keys: Map<string, TenantKey>): ModelConfig {
  const providers: Record<string, ProviderConfig> = { ...DEFAULT_MODEL_CONFIG.providers, ...override?.providers };
  for (const key of keys.values()) {
    const existing = providers[key.providerId];
    const base: ProviderConfig | undefined =
      existing ??
      (key.baseUrl
        ? {
            kind: "openai-compatible",
            label: key.label ?? key.providerId,
            shortLabel: key.label ?? key.providerId,
            description: "Eigener, OpenAI-kompatibler Anbieter.",
            baseUrl: key.baseUrl,
            apiKeySecret: `TENANT_KEY_${key.providerId}`,
            trainsOnData: key.trainsOnData !== false,
            paid: true,
            discoverModels: true,
            models: [],
          }
        : undefined);
    if (!base) continue;
    const known = new Set(base.models.map((model) => model.id));
    const discovered = (key.models ?? []).filter((id) => !known.has(id)).map((id) => ({ id, label: id }));
    providers[key.providerId] = { ...base, models: [...base.models, ...discovered] };
  }
  return { providers, aliases: { ...DEFAULT_MODEL_CONFIG.aliases, ...override?.aliases } };
}
