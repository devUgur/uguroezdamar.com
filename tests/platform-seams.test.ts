import { describe, expect, it } from "vitest";
import { OfficePresenceCore } from "../apps/api/src/office/presence.ts";
import { ThreadRuntime } from "../apps/api/src/runtime/thread-runtime.ts";
import { apiHarness } from "./_helpers/api-env.ts";
import { memoryActorState } from "./_helpers/memory-actor.ts";

/**
 * Phase P1 of ADR 0040: the actors of the core run on any ActorStatePort. Here on a Map and node:sqlite instead of
 * a Durable Object; the Cloudflare host only wraps these classes (apps/api/src/cloudflare/).
 */
const input = { tenantId: "owner", threadId: "t-1", agentId: "chef", projectId: "uguroezdamar", text: "Hallo" };

describe("thread runtime without Cloudflare", () => {
  it("queues a chat, schedules its stage, reports the run and stops it", async () => {
    const { env, db } = apiHarness();
    const { state, values, clock } = memoryActorState();
    const runtime = new ThreadRuntime(state, env);

    expect(await runtime.chat(input)).toEqual({ accepted: true });
    expect(clock.alarm).not.toBeNull();
    expect(await runtime.status()).toMatchObject({ running: true, step: 0 });
    expect((await runtime.chat({ ...input, text: "Noch was" })).busy).toBe(true);

    await runtime.stop();
    expect(await runtime.status()).toMatchObject({ running: false });
    expect(clock.alarm).toBeNull();
    expect([...values.keys()]).toEqual([]);
    const events = await db.prepare("SELECT type FROM events WHERE thread_id = 't-1' ORDER BY id").all<{ type: string }>();
    expect(events.results.map((event) => event.type)).toEqual(["user_message", "user_message", "stopped"]);
  });

  it("keeps its conversation in the actor's own SQL", async () => {
    const { env } = apiHarness();
    const { state, db } = memoryActorState();
    const runtime = new ThreadRuntime(state, env);
    expect(await runtime.history()).toEqual([]);
    expect(db.prepare("SELECT name FROM pragma_table_info('messages')").all().map((row) => row.name)).toContain("raw");
    await runtime.reset();
    expect(await runtime.history()).toEqual([]);
  });
});

describe("office presence without Cloudflare", () => {
  it("writes and publishes only real changes of activity", async () => {
    const { env } = apiHarness();
    const broadcasts: string[] = [];
    (env as { HUB: unknown }).HUB = { get: () => ({ broadcast: async (message: string) => void broadcasts.push(message) }) };
    const { state } = memoryActorState();
    const office = new OfficePresenceCore(state, env);
    await office.configure({ bounds: { minX: -6, maxX: 6, minZ: -4, maxZ: 6 }, agents: [{ agentId: "chef", desk: { x: 0, z: 0 }, seat: { x: 0, z: 0.8 }, activity: "idle", lastEventId: 0 }] });
    await office.setViewers(1);
    const before = broadcasts.length;
    await office.recordEvent({ id: 1, agentId: "chef", type: "user_message" });
    await office.recordEvent({ id: 2, agentId: "chef", type: "user_message" });
    await office.recordEvent({ id: 3, agentId: "chef", type: "approval_decided" });
    expect(broadcasts.length - before).toBe(1);
    await office.recordEvent({ id: 4, agentId: "chef", type: "message" });
    expect(broadcasts.length - before).toBe(2);
  });


  it("plans motion and wakes itself through the port", async () => {
    const { env } = apiHarness();
    const { state, clock } = memoryActorState();
    const office = new OfficePresenceCore(state, env);
    const snapshot = await office.configure({
      bounds: { minX: -6, maxX: 6, minZ: -4, maxZ: 6 },
      agents: [{ agentId: "chef", desk: { x: 0, z: 0 }, seat: { x: 0, z: 0.8 }, activity: "idle", lastEventId: 0 }],
    });
    expect(Object.keys(snapshot.agents)).toEqual(["chef"]);
    expect(snapshot.placements).toHaveLength(1);
    // Idle agents wander in the browsers; the room never wakes itself, watched or not (DO quota, 27.11.2026).
    await office.setViewers(1);
    expect(clock.alarm).toBeNull();
    await office.alarm();
    expect(clock.alarm).toBeNull();
  });
});

describe("event fan-out", () => {
  it("calls the office only for events that can change an agent's activity", async () => {
    const officeCalls: string[] = [];
    const { env } = apiHarness({ OFFICE: { get: () => ({ recordEvent: async (event: { type: string }) => void officeCalls.push(event.type) }) } });
    const { emit } = await import("../apps/api/src/events.ts");
    for (const type of ["user_message", "thinking", "model_result", "tool_call", "tool_result", "stage_paused", "message"] as const) {
      await emit(env, { tenantId: "owner", agentId: "chef", threadId: "t-1", type });
    }
    expect(officeCalls).toEqual(["user_message", "message"]);
  });
});
