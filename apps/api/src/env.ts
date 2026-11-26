import type { AgentRuntime } from "./agent.ts";
import type { LiveHub } from "./hub.ts";

/** Bindings from wrangler.jsonc plus secrets set by the deploy workflow. */
export interface Env {
  DB: D1Database;
  CONFIG: KVNamespace;
  FILES: R2Bucket;
  AI: Ai;
  AGENTS: DurableObjectNamespace<AgentRuntime>;
  HUB: DurableObjectNamespace<LiveHub>;

  DEFAULT_REPO: string;
  CF_ACCOUNT_ID: string;
  AI_GATEWAY_ID: string;
  MODEL_VIA_GATEWAY: string;
  /** "production" (branch main) or "dev" (branch dev). */
  API_ENV: string;
  /** Names of the storage behind the bindings; shown in the portal, never used to connect. */
  STORAGE: { d1: string; d1Region: string; kv: string; r2: string };
  /** "true" once the models in apps/api/modal/llm.py are deployed; until then Modal stays unselectable. */
  MODAL_ENABLED?: string;

  /** Shared with the portal server, one value per environment; the browser never sees it. */
  API_SERVICE_TOKEN?: string;
  GEMINI_API_KEY?: string;
  /** Fine-grained GitHub token: contents, pull requests and checks on the managed repositories. */
  AGENT_GITHUB_TOKEN?: string;
  OPENROUTER_API_KEY?: string;
  /** Key of the vLLM servers on Modal (apps/api/modal/llm.py); same value as the Modal secret uguroezdamar-llm. */
  MODAL_LLM_API_KEY?: string;
}

/** Reads a secret by the name a model provider is configured with. */
export function secret(env: Env, name: string): string | undefined {
  const value = (env as unknown as Record<string, unknown>)[name];
  return typeof value === "string" && value.length > 0 ? value : undefined;
}
