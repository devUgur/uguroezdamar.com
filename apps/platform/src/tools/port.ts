import type { Env } from "../env.ts";
import type { ToolSpec } from "../models/port.ts";

export interface ToolContext {
  env: Env;
  agentId: string;
  projectId: string;
  /** owner/name of the repository the project lives in. */
  repo: string;
}

/**
 * ToolPort: what an agent can do in the world. Tools that change something outside the
 * platform set `requiresApproval`; the agent then only proposes the call and Ugur decides.
 */
export interface Tool {
  spec: ToolSpec;
  requiresApproval?: boolean;
  run(args: Record<string, unknown>, context: ToolContext): Promise<unknown>;
}

export class ToolInputError extends Error {}

export function str(args: Record<string, unknown>, key: string, fallback?: string): string {
  const value = args[key];
  if (typeof value === "string" && value.length > 0) return value;
  if (fallback !== undefined) return fallback;
  throw new ToolInputError(`Argument "${key}" fehlt oder ist kein Text.`);
}
