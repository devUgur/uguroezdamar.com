import { afterEach, describe, expect, it, vi } from "vitest";
import type { Env } from "../apps/api/src/env.ts";
import { emit } from "../apps/api/src/events.ts";
import { SET_LIVE_VIEWERS } from "../apps/api/src/live/presence.ts";
import { batchedLive, batchMessage } from "../apps/api/src/runtime/live-batch.ts";
import { apiHarness } from "./_helpers/api-env.ts";

/** ADR 0025, Nachtrag 3: fewer Durable Object requests per run, nothing lost on the way. */
function hubStub() {
  const sent: string[] = [];
  return { sent, HUB: { get: () => ({ broadcast: async (message: string) => (sent.push(message), 1), fetch: async () => new Response(), issueTicket: async () => "t" }) } };
}

afterEach(() => vi.useRealTimers());

describe("live messages of a thread", () => {
  it("sends a burst of events as one request and streamed text at once", async () => {
    vi.useFakeTimers();
    const { sent, HUB } = hubStub();
    const live = batchedLive({ HUB } as unknown as Env, 1_000);
    const hub = live.env.HUB.get("main");
    await hub.broadcast('{"type":"event","event":{"id":1}}');
    await hub.broadcast('{"type":"event","event":{"id":2}}');
    expect(sent).toEqual([]);
    // Text leaves at once and takes the waiting events with it.
    await hub.broadcast('{"type":"delta","text":"Hal"}');
    expect(sent).toEqual(['{"type":"batch","messages":[{"type":"event","event":{"id":1}},{"type":"event","event":{"id":2}},{"type":"delta","text":"Hal"}]}']);
    await hub.broadcast('{"type":"event","event":{"id":3}}');
    await vi.advanceTimersByTimeAsync(1_000);
    expect(sent.at(-1)).toBe('{"type":"event","event":{"id":3}}');
    expect(sent).toHaveLength(2);
    await hub.broadcast('{"type":"event","event":{"id":4}}');
    await live.flush();
    expect(sent).toHaveLength(3);
    expect(JSON.parse(batchMessage(['{"a":1}', '{"b":2}']))).toEqual({ type: "batch", messages: [{ a: 1 }, { b: 2 }] });
  });

  it("updates the office only while one is open; the next office page catches up from the events table", async () => {
    const { env, db } = apiHarness();
    const recorded: number[] = [];
    (env as { OFFICE: unknown }).OFFICE = { get: () => ({ recordEvent: async (event: { id: number }) => void recorded.push(event.id) }) };
    const event = { tenantId: "owner", agentId: "chef", type: "message" as const, data: {} };
    await emit(env, event);
    expect(recorded).toEqual([]);
    await db.prepare(SET_LIVE_VIEWERS).bind("main", 1, 1).run();
    const stored = await emit(env, event);
    expect(recorded).toEqual([stored.id]);
  });
});
