import type { Env } from "../env.ts";
import type { ToolSpec } from "../models/port.ts";
import type { SubrequestBudget } from "../runtime/budget.ts";

export interface ToolContext {
  env: Env;
  /** The tenant the run belongs to: tools only see and change this tenant's projects and memories. */
  tenantId: string;
  agentId: string;
  projectId: string;
  /** owner/name of the repository the project lives in. */
  repo: string;
  /** External calls left in this invocation; take() before every fetch. */
  budget: SubrequestBudget;
  /**
   * Call with the private repositories (owner/name) before their content reaches the model. The thread remembers
   * them for good: as long as one of them is a strict project or no project at all, only models that do not
   * evaluate requests answer (ADR 0033). Repositories whose project the owner set to "open" do not restrict it.
   */
  markPrivate?: (repos: string[]) => Promise<void>;
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
