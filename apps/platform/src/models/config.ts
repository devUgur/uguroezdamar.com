/**
 * Which provider and model serve each alias. Agents only know aliases. The first target is
 * primary; the rest are fallbacks, tried in order on rate limits or outages.
 *
 * Override without a deploy: put a JSON object of the same shape under the KV key `models`.
 */
export interface ModelTarget {
  /** A key of `providers` below. */
  provider: string;
  model: string;
  /** USD per million tokens, for the budget guard. 0 for free tiers. */
  inputUsdPerM: number;
  outputUsdPerM: number;
}

export interface ProviderConfig {
  kind: "openai-compatible" | "workers-ai";
  /** Base URL without /chat/completions. `{gateway}` is replaced when MODEL_VIA_GATEWAY is on. */
  baseUrl?: string;
  /** Provider path behind the Cloudflare AI Gateway, used instead of baseUrl when it is on. */
  gatewayPath?: string;
  /** Name of the Worker secret that holds the API key. */
  apiKeySecret?: string;
}

export interface ModelConfig {
  providers: Record<string, ProviderConfig>;
  aliases: Record<string, ModelTarget[]>;
}

export const DEFAULT_MODEL_CONFIG: ModelConfig = {
  providers: {
    gemini: {
      kind: "openai-compatible",
      baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
      gatewayPath: "google-ai-studio/v1beta/openai",
      apiKeySecret: "GEMINI_API_KEY",
    },
    openrouter: {
      kind: "openai-compatible",
      baseUrl: "https://openrouter.ai/api/v1",
      gatewayPath: "openrouter",
      apiKeySecret: "OPENROUTER_API_KEY",
    },
    "workers-ai": { kind: "workers-ai" },
  },
  aliases: {
    "chef-smart": [
      { provider: "gemini", model: "gemini-flash-latest", inputUsdPerM: 0, outputUsdPerM: 0 },
      { provider: "workers-ai", model: "@cf/meta/llama-3.3-70b-instruct-fp8-fast", inputUsdPerM: 0, outputUsdPerM: 0 },
    ],
    coder: [
      { provider: "gemini", model: "gemini-flash-latest", inputUsdPerM: 0, outputUsdPerM: 0 },
      { provider: "workers-ai", model: "@cf/meta/llama-3.3-70b-instruct-fp8-fast", inputUsdPerM: 0, outputUsdPerM: 0 },
    ],
    "worker-cheap": [
      { provider: "gemini", model: "gemini-flash-lite-latest", inputUsdPerM: 0, outputUsdPerM: 0 },
      { provider: "workers-ai", model: "@cf/meta/llama-3.1-8b-instruct-fast", inputUsdPerM: 0, outputUsdPerM: 0 },
    ],
  },
};
