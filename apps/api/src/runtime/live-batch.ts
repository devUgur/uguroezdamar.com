import type { Env, LiveHubPort } from "../env.ts";
import type { ActorDirectory } from "../platform/ports.ts";

/**
 * Bundles a thread's live messages (ADR 0025, Nachtrag 3): every broadcast to the hub is one Durable Object request,
 * and a stage sends many events within milliseconds (thinking, tool call, tool result, …). Events wait up to
 * `holdMs` and go out together as one `{"type":"batch","messages":[…]}`. Streamed text (`delta`) leaves at once and
 * takes whatever is waiting with it, so text stays as fast as before and events ride along.
 */
export const LIVE_HOLD_MS = 1_000;

interface Queue {
  messages: string[];
  timer?: ReturnType<typeof setTimeout>;
}

export interface LiveBatch {
  env: Env;
  /** Sends everything waiting; the runtime calls it when a stage ends. */
  flush(): Promise<void>;
}

/** One message alone stays as it is; several become one batch. */
export function batchMessage(messages: string[]): string {
  return messages.length === 1 ? (messages[0] ?? "") : `{"type":"batch","messages":[${messages.join(",")}]}`;
}

export function batchedLive(env: Env, holdMs = LIVE_HOLD_MS): LiveBatch {
  const queues = new Map<string, Queue>();
  const hub = env.HUB;

  async function send(name: string): Promise<void> {
    const queue = queues.get(name);
    if (!queue || queue.messages.length === 0) return;
    clearTimeout(queue.timer);
    queue.timer = undefined;
    const messages = queue.messages.splice(0);
    try {
      await hub.get(name).broadcast(batchMessage(messages));
    } catch (error) {
      console.error("live batch broadcast failed", error);
    }
  }

  const batched: ActorDirectory<LiveHubPort> = {
    get(name: string) {
      const real = hub.get(name);
      return {
        fetch: (request) => real.fetch(request),
        issueTicket: () => real.issueTicket(),
        broadcast: async (message: string) => {
          let queue = queues.get(name);
          if (!queue) {
            queue = { messages: [] };
            queues.set(name, queue);
          }
          queue.messages.push(message);
          if (message.startsWith('{"type":"delta"')) {
            await send(name);
          } else {
            queue.timer ??= setTimeout(() => void send(name), holdMs);
          }
          // The receivers are counted when the batch goes out; until then nobody has it.
          return 0;
        },
      };
    },
  };

  return {
    env: { ...env, HUB: batched },
    flush: async () => {
      await Promise.all([...queues.keys()].map((name) => send(name)));
    },
  };
}
