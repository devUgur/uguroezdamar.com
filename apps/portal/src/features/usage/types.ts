/** Shapes of the agent API's usage ledger routes (apps/api/src/usage/routes.ts). */
export interface UsageTotals {
  costUsd: number;
  tokensIn: number;
  tokensOut: number;
  cacheReadTokens: number;
  calls: number;
  errors: number;
  avgLatencyMs: number | null;
}

export interface UsageGroup extends UsageTotals {
  key: string | null;
  label: string | null;
}

export interface UsageDay extends UsageTotals {
  day: string;
}

export interface AgentBudget {
  agentId: string;
  agent: string;
  budgetUsd: number;
  spentUsd: number;
  ratio: number;
  warning: boolean;
}

export interface UsageSummary {
  filter: { from: number; to: number };
  totals: UsageTotals | null;
  runs: { runs: number; running: number | null } | null;
  byDay: UsageDay[];
  byAgent: UsageGroup[];
  byModel: UsageGroup[];
  byProject: UsageGroup[];
  byProvider: UsageGroup[];
  budgets: AgentBudget[];
}

export interface ModelCallRow {
  id: number;
  ts: number;
  runId: string | null;
  agentId: string | null;
  agent: string | null;
  projectId: string | null;
  step: number | null;
  alias: string | null;
  provider: string;
  model: string;
  status: "ok" | "error";
  tokensIn: number;
  tokensOut: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  inputUsdPerM: number;
  outputUsdPerM: number;
  priceSource: string;
  costUsd: number;
  latencyMs: number | null;
  firstTokenMs: number | null;
  keySource: string | null;
  strictPolicy: number;
  error: string | null;
  attempts?: string[];
}

export interface RunRow {
  id: string;
  agentId: string;
  agent: string;
  projectId: string | null;
  threadId: string | null;
  taskId: string | null;
  kind: "chat" | "task" | "review";
  status: "running" | "done" | "failed" | "stopped" | "step_limit";
  startedAt: number;
  endedAt: number | null;
  steps: number;
  modelCalls: number;
  toolCalls: number;
  tokensIn: number;
  tokensOut: number;
  costUsd: number;
  outcome: string | null;
}

export interface ToolCallRow {
  id: number;
  ts: number;
  step: number | null;
  tool: string;
  argsPreview: string | null;
  ok: number;
  approvalId: string | null;
  durationMs: number | null;
  resultPreview: string | null;
}

export interface RunTrace {
  run: RunRow;
  modelCalls: ModelCallRow[];
  toolCalls: ToolCallRow[];
}

export interface FilterOption {
  id: string;
  label: string;
}

/** Filter as it travels in the page's query string. */
export interface UsageQuery {
  from?: string;
  to?: string;
  project?: string;
  agent?: string;
  provider?: string;
  model?: string;
}

/** Today's infrastructure usage against the plan's daily limits (API: /api/usage/infra). */
export interface InfraUsage {
  available: boolean;
  reason?: string;
  day?: string;
  measures: { key: string; label: string; used: number; limit: number; share: number; warn: boolean }[];
}
