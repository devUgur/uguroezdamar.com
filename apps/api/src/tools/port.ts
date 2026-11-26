import type { Env } from "../env.ts";
import type { ToolSpec } from "../models/port.ts";
import type { SubrequestBudget } from "../runtime/budget.ts";

export interface ToolContext {
  env: Env;
  /** The tenant the run belongs to: tools only see and change this tenant's projects and memories. */
  tenantId: string;
  agentId: string;
  /** Chat thread of the run, when there is one; workstation runs record their events under it. */
  threadId?: string;
  projectId: string;
  /** owner/name of the repository the project lives in. */
  repo: string;
  /** External calls left in this invocation; take() before every fetch. */
  budget: SubrequestBudget;
  /**
   * Call before returning content of private repositories to the model. From then on this thread is
   * private for good: its history holds that content, so only models that do not evaluate requests answer.
   */
  markPrivate?: () => Promise<void>;
}

/**
 * ToolPort: what an agent can do in the world. Tools that change something outside the
 * system set `requiresApproval`; the agent then only proposes the call and Ugur decides.
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
