import { randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import { hostname } from "node:os";
import { mkdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import type { Env } from "../env.ts";
import { KnowledgeIndexerCore } from "../knowledge/indexer.ts";
import { OfficePresenceCore } from "../office/presence.ts";
import { claim, dueJobs, jobOf, release, type DueJob } from "../runtime/scheduler.ts";
import { ThreadRuntime } from "../runtime/thread-runtime.ts";
import { sqlThread } from "../runtime/thread-store.ts";
import { actorHost, type ActorHost } from "./actors.ts";
import { NodeLiveHub } from "./hub.ts";
import { pgliteSql } from "./postgres.ts";
import type { SqlPort } from "../platform/ports.ts";
import { fileBlobs, memoryBlobs, noInference, noVectors, sqliteKeyValue } from "./storage.ts";

/**
 * The platform of the Node host (ADR 0045, R1 and R2): the same ports the core gets on Cloudflare, built from
 * Postgres, files and in-process actors. Nothing here talks to Cloudflare. The API's data is in Postgres: `sql` when
 * the caller brings one (Docker, Neon), otherwise PGlite in `dataDir/pg`. `dataDir` null keeps everything in memory.
 * The host's own small state (one-time tickets, caches, actor files) stays local to the host.
 */
export interface NodePlatformOptions {
  dataDir: string | null;
  /** Configuration and secrets as plain strings (the process environment in `main.ts`). */
  vars: Record<string, string | undefined>;
  /** The API's database; default PGlite (`dataDir/pg`, or in memory). */
  sql?: SqlPort & { close?(): Promise<void> | void };
  /** Sweep interval for foreign due jobs (default 30 minutes; NODE_HOST_SWEEP_MS). */
  sweepMs?: number;
}

export interface NodePlatform {
  env: Env;
  hub: NodeLiveHub;
  /** Re-arms stored wake-ups of office and indexer; returns how many. Threads wait in `scheduled_jobs`. */
  rearm(): number;
  /** This host's name on the leases it takes (ADR 0045, R3). */
  owner: string;
  /** One sweep over due jobs this host did not set itself; runs every `sweepMs` and once at start. */
  poll(): Promise<number>;
  close(): void;
}

// Workers add timingSafeEqual to crypto.subtle (the service-token check uses it); Node has it on node:crypto.
(crypto.subtle as unknown as { timingSafeEqual?: unknown }).timingSafeEqual ??= (a: ArrayBuffer | ArrayBufferView, b: ArrayBuffer | ArrayBufferView) => {
  const left = Buffer.from(ArrayBuffer.isView(a) ? a.buffer.slice(a.byteOffset, a.byteOffset + a.byteLength) : a);
  const right = Buffer.from(ArrayBuffer.isView(b) ? b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) : b);
  return left.length === right.length && timingSafeEqual(left, right);
};

/** How often the host sweeps the database for due jobs it did not set itself (another host's, after a crash). */
const SWEEP_MS = 30 * 60_000;

/** Only plain configuration of the core; the ports below always win. */
const PORT_NAMES = new Set(["DB", "CONFIG", "FILES", "AI", "AGENTS", "HUB", "OFFICE", "KNOWLEDGE", "INDEXER", "WORKSTATION", "NODE_SESSIONS", "INFRA_USAGE"]);

export function nodePlatform(options: NodePlatformOptions): NodePlatform {
  const dir = options.dataDir ? resolve(options.dataDir) : null;
  if (dir) mkdirSync(dir, { recursive: true });
  const local = options.sql ? null : pgliteSql(dir ? join(dir, "pg") : undefined);
  const DB: SqlPort = options.sql ?? local!;
  const hostDb = new DatabaseSync(dir ? join(dir, "host.sqlite") : ":memory:");

  const CONFIG = sqliteKeyValue(hostDb);
  const hub = new NodeLiveHub(DB);

  const vars = Object.fromEntries(Object.entries(options.vars).filter(([name, value]) => typeof value === "string" && !PORT_NAMES.has(name))) as Record<string, string>;
  // Encrypts model keys entered in the local portal. Generated once per data directory and kept in the host's own
  // database, beside the keys it protects; Infisical's value is never needed locally.
  const localKey = hostDb.prepare("SELECT value FROM host_kv WHERE key = 'local:provider-keys-secret'").get() as { value: string } | undefined;
  let providerKeysSecret = vars.PROVIDER_KEYS_SECRET ?? localKey?.value;
  if (!providerKeysSecret) {
    providerKeysSecret = randomBytes(32).toString("base64url");
    hostDb.prepare("INSERT INTO host_kv (key, value, expires_at) VALUES ('local:provider-keys-secret', ?, NULL)").run(providerKeysSecret);
  }

  const env = {
    DEFAULT_REPO: "devUgur/uguroezdamar.com",
    GITHUB_OWNERS: "devUgur",
    CF_ACCOUNT_ID: "",
    AI_GATEWAY_ID: "",
    API_ENV: "local",
    ...vars,
    // Model calls go straight to the providers; the Cloudflare AI Gateway is not on the way.
    MODEL_VIA_GATEWAY: "false",
    STORAGE: { d1: options.sql ? "postgres" : "pglite", d1Region: "local", kv: "node:sqlite", r2: "files" },
    PROVIDER_KEYS_SECRET: providerKeysSecret,
    DB,
    CONFIG,
    FILES: dir ? fileBlobs(join(dir, "files")) : memoryBlobs(),
    AI: noInference,
    KNOWLEDGE: noVectors,
    HUB: { get: () => hub },
  } as unknown as Env;

  // Threads live in the shared database (ADR 0045, R3): any host continues any of them once it holds the lease.
  // Own wake-ups fire from a timer in this process; the database is swept only now and then for jobs of a host that
  // died, so an idle host lets Neon scale to zero (R5).
  const owner = `node:${hostname()}:${process.pid}:${randomUUID().slice(0, 8)}`;
  const threads = new Map<string, ThreadRuntime>();
  const running = new Set<string>();
  const wakes = new Map<string, NodeJS.Timeout>();
  let closed = false;
  const report = (what: string) => (error: unknown) => console.error(what, error);
  const thread = (name: string): ThreadRuntime => {
    let known = threads.get(name);
    if (!known) {
      known = new ThreadRuntime(sqlThread(DB, name, (at) => wakeAt(name, at)), env);
      threads.set(name, known);
    }
    return known;
  };
  const agents = { get: thread };

  function wakeAt(key: string, at: number): void {
    if (closed) return;
    clearTimeout(wakes.get(key));
    const timer = setTimeout(() => {
      wakes.delete(key);
      void runThread(key).catch(report("thread wake-up failed"));
    }, Math.max(0, at - Date.now()));
    timer.unref?.();
    wakes.set(key, timer);
  }

  /** Runs the thread's next stage if it is due and free; afterwards follows its next wake-up. */
  async function runThread(key: string, known?: DueJob): Promise<boolean> {
    if (closed || running.has(key)) return false;
    const job = known ?? (await jobOf(DB, key));
    if (!job || ("dueAt" in job && (job.dueAt as number) > Date.now())) {
      if (job && "dueAt" in job) wakeAt(key, job.dueAt as number);
      return false;
    }
    if (!(await claim(DB, job, owner))) return false;
    running.add(key);
    try {
      await thread(key).alarm();
    } catch (error) {
      console.error("thread stage failed", key, error);
    } finally {
      running.delete(key);
      if (!closed) {
        await release(DB, job, owner).catch(report("lease release failed"));
        const next = await jobOf(DB, key).catch(() => null);
        if (next) wakeAt(key, next.dueAt);
      }
    }
    return true;
  }

  /** The sweep: due jobs nobody holds, e.g. of a host that stopped. Returns how many this host took. */
  async function poll(): Promise<number> {
    if (closed) return 0;
    let started = 0;
    for (const job of await dueJobs(DB)) {
      if (running.has(job.threadKey)) continue;
      started += 1;
      void runThread(job.threadKey, job).catch(report("thread stage failed"));
    }
    return started;
  }
  const sweepMs = options.sweepMs ?? SWEEP_MS;
  const sweep = setInterval(() => void poll().catch(report("scheduler sweep failed")), sweepMs);
  sweep.unref?.();
  // Right after the start: whatever was due while no host ran.
  setTimeout(() => void poll().catch(report("scheduler sweep failed")), 0).unref?.();
  const office: ActorHost<OfficePresenceCore> = actorHost(dir ? join(dir, "actors", "office") : null, (state) => new OfficePresenceCore(state, env));
  const indexer: ActorHost<KnowledgeIndexerCore> = actorHost(dir ? join(dir, "actors", "indexer") : null, (state) => new KnowledgeIndexerCore(state, env));
  Object.assign(env, { AGENTS: agents, OFFICE: office, INDEXER: indexer });

  return {
    env,
    hub,
    owner,
    poll,
    rearm: () => office.rearm() + indexer.rearm(),
    close() {
      closed = true;
      clearInterval(sweep);
      for (const timer of wakes.values()) clearTimeout(timer);
      hub.closeAll();
      office.close();
      indexer.close();
      hostDb.close();
      void (local ? local.pglite.close() : options.sql?.close?.());
    },
  };
}
