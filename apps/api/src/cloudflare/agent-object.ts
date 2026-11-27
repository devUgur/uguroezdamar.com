import { DurableObject } from "cloudflare:workers";
import type { ChatMessage } from "../models/port.ts";
import type { Accepted, AgentRuntimePort, AgentStatus, ChatInput, ResumeInput } from "../runtime/port.ts";
import { ThreadRuntime } from "../runtime/thread-runtime.ts";
import { actorThread } from "../runtime/thread-store.ts";
import { actorState, platformFrom, type CloudflareBindings } from "./platform.ts";

/** One Durable Object per chat thread; the runtime itself is platform-free (runtime/thread-runtime.ts). */
export class AgentRuntime extends DurableObject<CloudflareBindings> implements AgentRuntimePort {
  private readonly runtime: ThreadRuntime;

  constructor(ctx: DurableObjectState, bindings: CloudflareBindings) {
    super(ctx, bindings);
    this.runtime = new ThreadRuntime(actorThread(actorState(ctx)), platformFrom(bindings));
  }

  chat(input: ChatInput): Promise<Accepted> {
    return this.runtime.chat(input);
  }

  resume(input: ResumeInput): Promise<Accepted> {
    return this.runtime.resume(input);
  }

  stop(): Promise<void> {
    return this.runtime.stop();
  }

  status(tenantId?: string): Promise<AgentStatus> {
    return this.runtime.status(tenantId);
  }

  history(): Promise<ChatMessage[]> {
    return this.runtime.history();
  }

  view(tenantId?: string): Promise<{ messages: ChatMessage[]; status: AgentStatus }> {
    return this.runtime.view(tenantId);
  }

  reset(): Promise<void> {
    return this.runtime.reset();
  }

  override alarm(): Promise<void> {
    return this.runtime.alarm();
  }
}
