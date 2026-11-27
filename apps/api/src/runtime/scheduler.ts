import type { SqlPort } from "../platform/ports.ts";

/**
 * Continues due threads from `scheduled_jobs` (ADR 0045, R3), on any host: the Node host polls it, a second host
 * may run it at the same time. A job is taken with a lease; only one host can hold it. When the host dies, the lease
 * runs out and another one takes the job over. A wake-up set during the run (next stage) raises `version`, so the job
 * stays and is released for the next turn.
 */
export const LEASE_MS = 15 * 60_000;

export interface DueJob {
  threadKey: string;
  version: number;
}

export async function dueJobs(db: SqlPort, now = Date.now(), limit = 10): Promise<DueJob[]> {
  const { results } = await db
    .prepare("/* tenant:platform */ SELECT thread_key, version FROM scheduled_jobs WHERE due_at <= ? AND (lease_until IS NULL OR lease_until < ?) ORDER BY due_at LIMIT ?")
    .bind(now, now, limit)
    .all<{ thread_key: string; version: number }>();
  return results.map((row) => ({ threadKey: row.thread_key, version: Number(row.version) }));
}

/** The job of one thread, due or not; null when it has none. */
export async function jobOf(db: SqlPort, threadKey: string): Promise<(DueJob & { dueAt: number; leaseUntil: number | null }) | null> {
  const row = await db
    .prepare("/* tenant:platform */ SELECT thread_key, version, due_at, lease_until FROM scheduled_jobs WHERE thread_key = ?")
    .bind(threadKey)
    .first<{ thread_key: string; version: number; due_at: number; lease_until: number | null }>();
  return row ? { threadKey: row.thread_key, version: Number(row.version), dueAt: Number(row.due_at), leaseUntil: row.lease_until === null ? null : Number(row.lease_until) } : null;
}

/** Takes the job for `owner`; false when another host was quicker or the job changed. */
export async function claim(db: SqlPort, job: DueJob, owner: string, now = Date.now()): Promise<boolean> {
  const result = await db
    .prepare(
      "/* tenant:platform */ UPDATE scheduled_jobs SET lease_owner = ?, lease_until = ?, attempts = attempts + 1 WHERE thread_key = ? AND version = ? AND (lease_until IS NULL OR lease_until < ?)",
    )
    .bind(owner, now + LEASE_MS, job.threadKey, job.version, now)
    .run();
  return result.meta.changes === 1;
}

/** Ends the lease: the job is done unless it was rescheduled during the run. */
export async function release(db: SqlPort, job: DueJob, owner: string): Promise<void> {
  await db.prepare("/* tenant:platform */ DELETE FROM scheduled_jobs WHERE thread_key = ? AND version = ? AND lease_owner = ?").bind(job.threadKey, job.version, owner).run();
  await db
    .prepare("/* tenant:platform */ UPDATE scheduled_jobs SET lease_owner = NULL, lease_until = NULL, attempts = 0 WHERE thread_key = ? AND lease_owner = ?")
    .bind(job.threadKey, owner)
    .run();
}

/**
 * One pass: takes every due job this host can get and runs it through `run` (the thread's `alarm()`). Errors are the
 * runtime's to report; the lease is released either way. Returns how many jobs ran.
 */
export async function runDue(db: SqlPort, owner: string, run: (threadKey: string) => Promise<void>): Promise<number> {
  let ran = 0;
  for (const job of await dueJobs(db)) {
    if (!(await claim(db, job, owner))) continue;
    try {
      await run(job.threadKey);
    } catch (error) {
      console.error("scheduled thread failed", job.threadKey, error);
    } finally {
      await release(db, job, owner);
    }
    ran += 1;
  }
  return ran;
}
