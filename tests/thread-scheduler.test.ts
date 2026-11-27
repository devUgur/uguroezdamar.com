import { describe, expect, it } from "vitest";
import { claim, dueJobs, LEASE_MS, release, runDue } from "../apps/api/src/runtime/scheduler.ts";
import { sqlThread, tenantOfThread } from "../apps/api/src/runtime/thread-store.ts";
import { apiHarness } from "./_helpers/api-env.ts";

/**
 * ADR 0045, R3: a thread's state and its next stage live in shared SQL. Two hosts share one database; a lease decides
 * who continues a thread, and a dead host's lease runs out. Runs on SQLite and, with `pnpm test:pg`, on Postgres.
 */
describe("threads in shared SQL", () => {
  it("keeps messages and values of a thread apart from other threads and tenants", async () => {
    const { db } = apiHarness();
    const a = sqlThread(db, "thread:a").store;
    const b = sqlThread(db, "t:acme:thread:a").store;
    await a.messages.append({ role: "user", content: "Hallo" });
    await a.messages.append({ role: "assistant", content: null, toolCalls: [{ id: "c1", name: "x", arguments: "{}" }] });
    await b.messages.append({ role: "user", content: "Andere Firma" });
    await a.put("run", { steps: 2, taskId: "t-1" });

    expect(await a.messages.nextId()).toBe(3);
    expect((await a.messages.recent(10)).map((message) => [message.id, message.role, message.content])).toEqual([
      [1, "user", "Hallo"],
      [2, "assistant", null],
    ]);
    expect((await a.messages.window(2, 1)).map((message) => message.id)).toEqual([1, 2]);
    expect((await a.messages.between(0, 2)).map((message) => message.content)).toEqual(["Hallo"]);
    expect(await a.get("run")).toEqual({ steps: 2, taskId: "t-1" });
    expect(await b.get("run")).toBeUndefined();
    expect((await b.messages.recent(10)).map((message) => message.content)).toEqual(["Andere Firma"]);
    expect(tenantOfThread("t:acme:thread:a")).toBe("acme");

    await a.messages.clear();
    await a.delete(["run"]);
    expect(await a.messages.recent(10)).toEqual([]);
    expect(await a.get("run")).toBeUndefined();
    expect(await b.messages.nextId()).toBe(2);
  });

  it("lets one host take a due thread, and another once the first one's lease has run out", async () => {
    const { db } = apiHarness();
    await sqlThread(db, "thread:x").scheduler.wakeAt(Date.now() - 1);
    const [job] = await dueJobs(db);
    expect(job).toMatchObject({ threadKey: "thread:x" });

    expect(await claim(db, job!, "host-a")).toBe(true);
    expect(await claim(db, job!, "host-b")).toBe(false);
    expect(await dueJobs(db)).toEqual([]);
    // host-a dies: after the lease, host-b continues the same thread.
    expect(await dueJobs(db, Date.now() + LEASE_MS + 1)).toHaveLength(1);
    expect(await claim(db, job!, "host-b", Date.now() + LEASE_MS + 1)).toBe(true);
  });

  it("keeps a job that was rescheduled during its run and drops it when the run ends without a next stage", async () => {
    const { db } = apiHarness();
    const scheduler = sqlThread(db, "thread:y").scheduler;
    await scheduler.wakeAt(Date.now() - 1);
    const ran: string[] = [];
    // The stage plans its next stage, as ThreadRuntime does with a paused run.
    expect(await runDue(db, "host-a", async (key) => {
      ran.push(key);
      await scheduler.wakeAt(Date.now() - 1);
    })).toBe(1);
    expect(await dueJobs(db)).toHaveLength(1);
    // The next stage ends the run: no wake-up, the job is gone.
    expect(await runDue(db, "host-a", async (key) => void ran.push(key))).toBe(1);
    expect(await dueJobs(db, Date.now() + LEASE_MS * 2)).toEqual([]);
    expect(ran).toEqual(["thread:y", "thread:y"]);

    await scheduler.wakeAt(Date.now() + 60_000);
    await scheduler.cancel();
    expect(await dueJobs(db, Date.now() + 120_000)).toEqual([]);
  });

  it("releases a lease that only this host holds", async () => {
    const { db } = apiHarness();
    await sqlThread(db, "thread:z").scheduler.wakeAt(Date.now() - 1);
    const [job] = await dueJobs(db);
    await claim(db, job!, "host-a");
    await release(db, job!, "host-b");
    expect(await dueJobs(db)).toEqual([]);
    await release(db, job!, "host-a");
    expect(await dueJobs(db)).toEqual([]);
  });
});
