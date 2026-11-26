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
  /** USD per million tokens. Missing means unknown: a paid provider then counts with DEFAULT_PAID_PRICE. */
  inputUsdPerM?: number;
  outputUsdPerM?: number;
  /** Own endpoint for this model, when a provider serves each model separately (Modal). */
  baseUrl?: string;
  /** Shown next to the name in the portal, e.g. cost or cold start. */
  note?: string;
  /** The model only accepts tool-call ids of exactly nine letters/digits (Mistral); ids are rewritten on the way out. */
  shortToolCallIds?: boolean;
}

export interface ProviderConfig {
  /** Which adapter speaks to it: the OpenAI chat format, Anthropic's Messages API, or the Workers AI binding. */
  kind: "openai-compatible" | "anthropic" | "workers-ai";
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
  /** The provider bills per token. Models without a price then count with DEFAULT_PAID_PRICE, so the daily budget still holds. */
  paid?: boolean;
  /** Where a key is created; the portal links to it. */
  keyUrl?: string;
  /** The provider lists its models at GET {baseUrl}/models; the portal can load them once a key is set. */
  discoverModels?: boolean;
  /** Every model of this provider wants nine-character tool-call ids (Mistral). */
  shortToolCallIds?: boolean;
  /** One line for the portal: what the provider is good for. */
  description?: string;
  /** Price for a model of this provider without its own price; without it a paid provider counts DEFAULT_PAID_PRICE. */
  unknownModelPrice?: { inputUsdPerM: number; outputUsdPerM: number };
}

/** Assumed price of a paid model without a known price: deliberately high, so an unknown model cannot run up a bill. */
export const DEFAULT_PAID_PRICE = { inputUsdPerM: 5, outputUsdPerM: 25 };

export interface ModelConfig {
  providers: Record<string, ProviderConfig>;
  aliases: Record<string, ModelTarget[]>;
}

export const DEFAULT_MODEL_CONFIG: ModelConfig = {
  providers: {
    // Paid providers. Each is used once a key is set, in the portal (per tenant, encrypted) or as a Worker
    // secret of the owner. trainsOnData is false only where the provider's API terms exclude training by default.
    anthropic: {
      kind: "anthropic",
      label: "Anthropic (Claude)",
      shortLabel: "Claude",
      description: "Stärkste Wahl für Agenten mit Werkzeugen und Code; API-Daten werden nicht zum Training genutzt.",
      trainsOnData: false,
      paid: true,
      discoverModels: true,
      keyUrl: "https://console.anthropic.com/settings/keys",
      baseUrl: "https://api.anthropic.com",
      apiKeySecret: "ANTHROPIC_API_KEY",
      models: [
        { id: "claude-sonnet-5-5", label: "Claude Sonnet 5.5", note: "Standard für Agenten", inputUsdPerM: 2, outputUsdPerM: 10 },
        { id: "claude-opus-5-5", label: "Claude Opus 5.5", note: "für schwierige Aufgaben", inputUsdPerM: 4, outputUsdPerM: 20 },
        { id: "claude-haiku-5-5", label: "Claude Haiku 5.5", note: "schnell und günstig", inputUsdPerM: 0.1, outputUsdPerM: 0.5 },
      ],
    },
    openai: {
      kind: "openai-compatible",
      label: "OpenAI",
      shortLabel: "OpenAI",
      description: "GPT-Modelle; API-Daten werden standardmäßig nicht zum Training genutzt. Modelle werden nach dem Schlüssel geladen.",
      trainsOnData: false,
      paid: true,
      discoverModels: true,
      keyUrl: "https://platform.openai.com/api-keys",
      baseUrl: "https://api.openai.com/v1",
      gatewayPath: "openai",
      apiKeySecret: "OPENAI_API_KEY",
      models: [],
    },
    deepseek: {
      kind: "openai-compatible",
      label: "DeepSeek",
      shortLabel: "DeepSeek",
      description: "Sehr günstig. Laut Datenschutzerklärung dürfen Eingaben zum Training genutzt werden (Widerspruch möglich), Speicherung in China: nur für Projekte mit offener Datenrichtlinie.",
      trainsOnData: true,
      paid: true,
      discoverModels: true,
      keyUrl: "https://platform.deepseek.com/api_keys",
      baseUrl: "https://api.deepseek.com/v1",
      gatewayPath: "deepseek",
      apiKeySecret: "DEEPSEEK_API_KEY",
      unknownModelPrice: { inputUsdPerM: 1.32, outputUsdPerM: 3.96 },
      models: [
        // Peak prices as reported by third parties in 11/2026 (off-peak is half): an upper bound for the budget.
        { id: "deepseek-flash", label: "DeepSeek Flash", note: "günstig, schnell", inputUsdPerM: 0.3, outputUsdPerM: 1.2 },
        { id: "deepseek-v4-pro", label: "DeepSeek V4 Pro", note: "stärker", inputUsdPerM: 1.32, outputUsdPerM: 3.96 },
        // Older names some keys still accept; priced like the model they point to.
        { id: "deepseek-chat", label: "DeepSeek Chat (alter Name)", inputUsdPerM: 0.3, outputUsdPerM: 1.2 },
        { id: "deepseek-reasoner", label: "DeepSeek Reasoner (alter Name)", inputUsdPerM: 1.32, outputUsdPerM: 3.96 },
      ],
    },
    moonshot: {
      kind: "openai-compatible",
      label: "Moonshot (Kimi)",
      shortLabel: "Kimi",
      description: "Kimi-Modelle mit langem Kontext. Modelle werden nach dem Schlüssel geladen.",
      trainsOnData: true,
      paid: true,
      discoverModels: true,
      keyUrl: "https://platform.moonshot.ai/console/api-keys",
      baseUrl: "https://api.moonshot.ai/v1",
      apiKeySecret: "MOONSHOT_API_KEY",
      models: [],
    },
    mistral: {
      kind: "openai-compatible",
      label: "Mistral AI",
      shortLabel: "Mistral",
      description: "Europäischer Anbieter. Modelle werden nach dem Schlüssel geladen.",
      trainsOnData: true,
      paid: true,
      discoverModels: true,
      shortToolCallIds: true,
      keyUrl: "https://console.mistral.ai/api-keys",
      baseUrl: "https://api.mistral.ai/v1",
      gatewayPath: "mistral",
      apiKeySecret: "MISTRAL_API_KEY",
      models: [],
    },
    groq: {
      kind: "openai-compatible",
      label: "Groq",
      shortLabel: "Groq",
      description: "Sehr schnelle Antworten auf offenen Modellen. Modelle werden nach dem Schlüssel geladen.",
      trainsOnData: true,
      paid: true,
      discoverModels: true,
      keyUrl: "https://console.groq.com/keys",
      baseUrl: "https://api.groq.com/openai/v1",
      gatewayPath: "groq",
      apiKeySecret: "GROQ_API_KEY",
      models: [],
    },
    xai: {
      kind: "openai-compatible",
      label: "xAI (Grok)",
      shortLabel: "Grok",
      description: "Grok-Modelle. Modelle werden nach dem Schlüssel geladen.",
      trainsOnData: true,
      paid: true,
      discoverModels: true,
      keyUrl: "https://console.x.ai",
      baseUrl: "https://api.x.ai/v1",
      gatewayPath: "grok",
      apiKeySecret: "XAI_API_KEY",
      models: [],
    },
    together: {
      kind: "openai-compatible",
      label: "Together AI",
      shortLabel: "Together",
      description: "Viele offene Modelle (Llama, Qwen, DeepSeek, Kimi) über eine API.",
      trainsOnData: true,
      paid: true,
      discoverModels: true,
      keyUrl: "https://api.together.ai/settings/api-keys",
      baseUrl: "https://api.together.xyz/v1",
      apiKeySecret: "TOGETHER_API_KEY",
      models: [],
    },
    fireworks: {
      kind: "openai-compatible",
      label: "Fireworks AI",
      shortLabel: "Fireworks",
      description: "Schnelle offene Modelle. Modelle werden nach dem Schlüssel geladen.",
      trainsOnData: true,
      paid: true,
      discoverModels: true,
      keyUrl: "https://fireworks.ai/account/api-keys",
      baseUrl: "https://api.fireworks.ai/inference/v1",
      apiKeySecret: "FIREWORKS_API_KEY",
      models: [],
    },
    gemini: {
      kind: "openai-compatible",
      label: "Google Gemini",
      shortLabel: "Gemini",
      // Free tier of the Gemini API: Google may use requests for product improvement.
      trainsOnData: true,
      description: "Kostenlose Stufe von Google AI Studio; Eingaben dürfen ausgewertet werden.",
      discoverModels: true,
      keyUrl: "https://aistudio.google.com/apikey",
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
      description: "Ein Schlüssel für Hunderte Modelle vieler Anbieter; Datenschutz hängt vom jeweiligen Modell ab.",
      trainsOnData: true,
      paid: true,
      discoverModels: true,
      keyUrl: "https://openrouter.ai/settings/keys",
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
      description: "Eigene Open-Weight-Modelle auf gemieteten GPUs; skaliert auf null, daher Kaltstart nach einer Pause.",
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
      description: "Läuft direkt bei Cloudflare, kein Schlüssel nötig; kleines kostenloses Tageskontingent.",
      models: [
        { id: "@cf/meta/llama-3.3-70b-instruct-fp8-fast", label: "Llama 3.3 70B", inputUsdPerM: 0, outputUsdPerM: 0 },
        { id: "@cf/meta/llama-3.1-8b-instruct-fast", label: "Llama 3.1 8B (schnell)", inputUsdPerM: 0, outputUsdPerM: 0 },
      ],
    },
  },
  // A provider without a key is skipped, so a paid provider at the front costs nothing until a key exists.
  // Free tier as of 2026-11 (aistudio.google.com/docs/pricing). gemini-flash-latest is Google's
  // rolling alias; gemini-2.5-flash is deprecated and must not be used.
  aliases: {
    "chef-smart": [
      { provider: "anthropic", model: "claude-sonnet-5-5", inputUsdPerM: 2, outputUsdPerM: 10 },
      { provider: "gemini", model: "gemini-flash-latest", inputUsdPerM: 0, outputUsdPerM: 0 },
      { provider: "gemini", model: "gemini-3.5-flash-lite", inputUsdPerM: 0, outputUsdPerM: 0 },
      { provider: "workers-ai", model: "@cf/meta/llama-3.3-70b-instruct-fp8-fast", inputUsdPerM: 0, outputUsdPerM: 0 },
    ],
    coder: [
      { provider: "anthropic", model: "claude-sonnet-5-5", inputUsdPerM: 2, outputUsdPerM: 10 },
      { provider: "gemini", model: "gemini-flash-latest", inputUsdPerM: 0, outputUsdPerM: 0 },
      { provider: "gemini", model: "gemini-3.5-flash-lite", inputUsdPerM: 0, outputUsdPerM: 0 },
      { provider: "workers-ai", model: "@cf/meta/llama-3.3-70b-instruct-fp8-fast", inputUsdPerM: 0, outputUsdPerM: 0 },
    ],
    "worker-cheap": [
      { provider: "anthropic", model: "claude-haiku-5-5", inputUsdPerM: 0.1, outputUsdPerM: 0.5 },
      { provider: "gemini", model: "gemini-3.5-flash-lite", inputUsdPerM: 0, outputUsdPerM: 0 },
      { provider: "workers-ai", model: "@cf/meta/llama-3.1-8b-instruct-fast", inputUsdPerM: 0, outputUsdPerM: 0 },
    ],
  },
};
