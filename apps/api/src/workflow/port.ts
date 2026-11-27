import type { Caller } from "../auth.ts";
import type { Env } from "../env.ts";
import type { DeliveryView } from "./engine.ts";

/**
 * The workflow port (ADR 0040, P3). The first adapter keeps the state in SQL and moves on when a step's agent run
 * ends (engine.ts); it runs unchanged on every host. A Cloudflare Workflows adapter can implement the same port later.
 */
export interface WorkflowPort {
  start(env: Env, caller: Caller, taskId: string): Promise<{ workflowRunId: string; threadId: string }>;
  /** The run of a conversation ended; returns false when the conversation is no workflow step. */
  stepFinished(env: Env, input: { tenantId: string; threadId: string; outcome: "done" | "failed" | "cancelled"; output: string }): Promise<boolean>;
  retry(env: Env, caller: Caller, taskId: string): Promise<void>;
  cancel(env: Env, caller: Caller, taskId: string): Promise<void>;
  accepted(env: Env, tenantId: string, taskId: string): Promise<void>;
  list(env: Env, tenantId: string): Promise<DeliveryView[]>;
}
