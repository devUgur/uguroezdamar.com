/** Shapes of the agent API (apps/api) as the portal chat uses them. */

export interface ModelChoice {
  provider: string;
  model: string;
}

export interface Thread {
  id: string;
  agentId: string;
  projectId: string;
  title: string | null;
  model: ModelChoice | null;
  createdBy: string | null;
  createdAt: number;
  updatedAt: number;
  lastEvent: string | null;
}

export interface ToolCall {
  id: string;
  name: string;
  arguments: string;
}

export interface ChatMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
  toolCalls?: ToolCall[];
  toolCallId?: string;
}

export interface Approval {
  id: string;
  agentId: string;
  threadId: string | null;
  action: string;
  summary: string | null;
  risk: string | null;
  warnings: string[];
  expiresAt: number | null;
}

export interface AgentEvent {
  id: number;
  ts: number;
  type: string;
  agentId?: string;
  threadId?: string;
  data?: Record<string, unknown>;
  tokensIn?: number;
  tokensOut?: number;
  costUsd?: number;
}

export interface ThreadDetail {
  thread: Thread;
  messages: ChatMessage[];
  status: { running: boolean; step: number; startedAt?: number };
  approvals: Approval[];
  events: AgentEvent[];
}

export interface CatalogProvider {
  id: string;
  label: string;
  shortLabel: string;
  available: boolean;
  models: { id: string; label: string; note?: string; inputUsdPerM: number; outputUsdPerM: number }[];
}

export interface ModelCatalog {
  providers: CatalogProvider[];
  agentAliases: Record<string, string>;
}

export interface AgentSummary {
  id: string;
  name: string;
  role: string;
  summary: string;
  modelAlias: string;
  dailyBudgetUsd: number;
  desk: { x: number; y: number };
  lastEvent: string | null;
  lastEventAt: number | null;
  lastThreadId: string | null;
}

/** Everything a chat needs, loaded together for a dialog that has no page around it. */
export interface ChatView {
  detail: ThreadDetail;
  catalog: ModelCatalog;
  liveOrigin: string | null;
}

/** Read-only configuration of one agent, as the API describes it (apps/api/src/agents/describe.ts). */
export interface AgentConfig {
  id: string;
  name: string;
  role: string;
  summary: string;
  desk: { x: number; y: number };
  model: { alias: string; chain: { provider: string; providerLabel: string; model: string; available: boolean }[] };
  tools: { name: string; description: string; requiresApproval: boolean; inputs: { name: string; required: boolean }[] }[];
  prompt: string;
  limits: {
    maxSteps: number;
    subrequestsPerStage: number;
    historyMessages: number;
    staleRunMinutes: number;
    approvalHours: number;
    dailyBudgetUsd: number;
    spentTodayUsd: number;
  };
  storage: {
    environment: string;
    project: { id: string; name: string; repo: string };
    database: { name: string; region: string; binding: string };
    config: { name: string; binding: string };
    files: { name: string; binding: string };
    conversations: string;
  };
  data: { threads: number; events: number; costUsdTotal: number; pendingApprovals: number; projectNotes: number };
  guardrails: { workBranch: string; agentBranchPrefix: string; neverWritesTo: string; protectedPaths: { path: string; reason: string }[] };
  credentials: { name: string; purpose: string; set: boolean }[];
}
