import type { AgentRuntime } from "./agent.ts";
import type { LiveHub } from "./hub.ts";

/** Bindings from wrangler.jsonc plus secrets set by the deploy workflow. */
export interface Env {
  DB: D1Database;
  CONFIG: KVNamespace;
  FILES: R2Bucket;
  AI: Ai;
  ASSETS: Fetcher;
  AGENTS: DurableObjectNamespace<AgentRuntime>;
  HUB: DurableObjectNamespace<LiveHub>;

  DEFAULT_REPO: string;
  CF_ACCOUNT_ID: string;
  AI_GATEWAY_ID: string;
  MODEL_VIA_GATEWAY: string;
  ACCESS_TEAM_DOMAIN: string;
  ACCESS_AUD: string;
  /** "production" (branch main) or "dev" (branch dev). */
  PLATFORM_ENV: string;

  /** Long random value; the browser sends it as a bearer token until Cloudflare Access is in front. */
  PLATFORM_ADMIN_TOKEN?: string;
  GEMINI_API_KEY?: string;
  /** Fine-grained GitHub token: contents, pull requests and actions on the managed repositories. */
  AGENT_GITHUB_TOKEN?: string;
  OPENROUTER_API_KEY?: string;
}

/** Reads a secret by the name a model provider is configured with. */
export function secret(env: Env, name: string): string | undefined {
  const value = (env as unknown as Record<string, unknown>)[name];
  return typeof value === "string" && value.length > 0 ? value : undefined;
}
