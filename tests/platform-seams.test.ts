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
    // Nobody watches yet: no wake-up. Once a browser looks, idle agents walk and the office schedules its next move.
    expect(clock.alarm).toBeNull();
    await office.setViewers(1);
    expect(clock.alarm).toBeGreaterThan(Date.now() - 1_000);
    await office.setViewers(0);
    expect(clock.alarm).toBeNull();
  });
});
