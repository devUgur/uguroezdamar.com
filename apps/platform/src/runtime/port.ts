import type { ChatMessage } from "../models/port.ts";

/**
 * AgentRuntimePort: how the API talks to an agent. Today one Durable Object per agent
 * (agent.ts) implements it; the loop itself is runtime-neutral (loop.ts).
 *
 * chat and resume only accept work. The agent runs it in stages and reports through events
 * (live hub), so a long task never blocks the HTTP request.
 */
export interface ChatInput {
  agentId: string;
  projectId: string;
  text: string;
}

export interface ResumeInput {
  agentId: string;
  projectId: string;
  approvalId: string;
  tool: string;
  approved: boolean;
  outcome: string;
}

export interface Accepted {
  accepted: boolean;
  /** Set when the agent is still busy with an earlier task. */
  busy?: boolean;
  message?: string;
}

export interface AgentStatus {
  running: boolean;
  step: number;
  startedAt?: number;
}

export interface AgentRuntimePort {
  chat(input: ChatInput): Promise<Accepted>;
  resume(input: ResumeInput): Promise<Accepted>;
  stop(): Promise<void>;
  status(): Promise<AgentStatus>;
  history(): Promise<ChatMessage[]>;
  reset(): Promise<void>;
}
