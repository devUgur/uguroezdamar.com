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

/** A model the portal offers in its picker. */
export interface CatalogModel {
  id: string;
  label: string;
  inputUsdPerM: number;
  outputUsdPerM: number;
  /** Own endpoint for this model, when a provider serves each model separately (Modal). */
  baseUrl?: string;
  /** Shown next to the name in the portal, e.g. cost or cold start. */
  note?: string;
  /** The model only accepts tool-call ids of exactly nine letters/digits (Mistral); ids are rewritten on the way out. */
  shortToolCallIds?: boolean;
}

export interface ProviderConfig {
  kind: "openai-compatible" | "workers-ai";
  /** Name shown in the portal. */
  label: string;
  /** Models offered for manual choice; aliases may use others. */
  models: CatalogModel[];
  /** Base URL without /chat/completions. `{gateway}` is replaced when MODEL_VIA_GATEWAY is on. */
  baseUrl?: string;
  /** Provider path behind the Cloudflare AI Gateway, used instead of baseUrl when it is on. */
  gatewayPath?: string;
  /** Name of the Worker secret that holds the API key. */
  apiKeySecret?: string;
  /** Worker variable that must be "true" before the provider can be chosen (e.g. once its servers are deployed). */
  enabledVar?: string;
  /** Short name in front of each model in the portal's list. */
  shortLabel?: string;
  /**
   * The provider may use prompts and answers to improve its models (free tiers usually may). Content of
   * private repositories is never sent to such a provider. Missing counts as true: unknown is unsafe.
   */
  trainsOnData?: boolean;
}

export interface ModelConfig {
  providers: Record<string, ProviderConfig>;
  aliases: Record<string, ModelTarget[]>;
}

export const DEFAULT_MODEL_CONFIG: ModelConfig = {
  providers: {
    gemini: {
      kind: "openai-compatible",
      label: "Google Gemini",
      shortLabel: "Gemini",
      // Free tier of the Gemini API: Google may use requests for product improvement.
      trainsOnData: true,
      models: [
        { id: "gemini-flash-latest", label: "Gemini Flash (aktuell)", inputUsdPerM: 0, outputUsdPerM: 0 },
        { id: "gemini-3.5-flash-lite", label: "Gemini 3.5 Flash-Lite", inputUsdPerM: 0, outputUsdPerM: 0 },
      ],
      baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
      gatewayPath: "google-ai-studio/v1beta/openai",
      apiKeySecret: "GEMINI_API_KEY",
    },
    openrouter: {
      kind: "openai-compatible",
      label: "OpenRouter",
      shortLabel: "OpenRouter",
      trainsOnData: true,
      models: [],
      baseUrl: "https://openrouter.ai/api/v1",
      gatewayPath: "openrouter",
      apiKeySecret: "OPENROUTER_API_KEY",
    },
    // Own GPUs on Modal (apps/api/modal/llm.py), billed per second and idle at zero. Never part of
    // an alias chain: only used when a thread picks one of these models explicitly.
    modal: {
      kind: "openai-compatible",
      label: "Modal (eigene GPUs)",
      shortLabel: "Modal",
      // Our own vLLM servers: nothing leaves the workspace.
      trainsOnData: false,
      apiKeySecret: "MODAL_LLM_API_KEY",
      enabledVar: "MODAL_ENABLED",
      models: [
        {
          id: "mistralai/Ministral-3-8B-Instruct-2512",
          label: "Ministral 3 8B",
          shortToolCallIds: true,
          baseUrl: "https://ugur44ist--uguroezdamar-llm-ministral.us-east.modal.run/v1",
          note: "L40S, ca. 1,95 $/h, Kaltstart 1–2 min",
          inputUsdPerM: 0,
          outputUsdPerM: 0,
        },
        {
          id: "google/gemma-4-26B-A4B-it",
          label: "Gemma 4 26B-A4B",
          baseUrl: "https://ugur44ist--uguroezdamar-llm-gemma.us-east.modal.run/v1",
          note: "H100, ca. 3,95 $/h, Kaltstart 1–3 min",
          inputUsdPerM: 0,
          outputUsdPerM: 0,
        },
      ],
    },
    "workers-ai": {
      kind: "workers-ai",
      label: "Cloudflare Workers AI",
      shortLabel: "Workers AI",
      // Cloudflare does not train on Workers AI customer content.
      trainsOnData: false,
      models: [
        { id: "@cf/meta/llama-3.3-70b-instruct-fp8-fast", label: "Llama 3.3 70B", inputUsdPerM: 0, outputUsdPerM: 0 },
        { id: "@cf/meta/llama-3.1-8b-instruct-fast", label: "Llama 3.1 8B (schnell)", inputUsdPerM: 0, outputUsdPerM: 0 },
      ],
    },
  },
  // Free tier as of 2026-11 (aistudio.google.com/docs/pricing). gemini-flash-latest is Google's
  // rolling alias; gemini-2.5-flash is deprecated and must not be used.
  aliases: {
    "chef-smart": [
      { provider: "gemini", model: "gemini-flash-latest", inputUsdPerM: 0, outputUsdPerM: 0 },
      { provider: "gemini", model: "gemini-3.5-flash-lite", inputUsdPerM: 0, outputUsdPerM: 0 },
      { provider: "workers-ai", model: "@cf/meta/llama-3.3-70b-instruct-fp8-fast", inputUsdPerM: 0, outputUsdPerM: 0 },
    ],
    coder: [
      { provider: "gemini", model: "gemini-flash-latest", inputUsdPerM: 0, outputUsdPerM: 0 },
      { provider: "gemini", model: "gemini-3.5-flash-lite", inputUsdPerM: 0, outputUsdPerM: 0 },
      { provider: "workers-ai", model: "@cf/meta/llama-3.3-70b-instruct-fp8-fast", inputUsdPerM: 0, outputUsdPerM: 0 },
    ],
    "worker-cheap": [
      { provider: "gemini", model: "gemini-3.5-flash-lite", inputUsdPerM: 0, outputUsdPerM: 0 },
      { provider: "workers-ai", model: "@cf/meta/llama-3.1-8b-instruct-fast", inputUsdPerM: 0, outputUsdPerM: 0 },
    ],
  },
};
