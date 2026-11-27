import { randomBytes, timingSafeEqual } from "node:crypto";
import { mkdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import type { Env } from "../env.ts";
import { KnowledgeIndexerCore } from "../knowledge/indexer.ts";
import { OfficePresenceCore } from "../office/presence.ts";
import { ThreadRuntime } from "../runtime/thread-runtime.ts";
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
}

export interface NodePlatform {
  env: Env;
  hub: NodeLiveHub;
  /** Re-arms stored wake-ups of threads, office and indexer; returns how many. */
  rearm(): number;
  close(): void;
}

// Workers add timingSafeEqual to crypto.subtle (the service-token check uses it); Node has it on node:crypto.
(crypto.subtle as unknown as { timingSafeEqual?: unknown }).timingSafeEqual ??= (a: ArrayBuffer | ArrayBufferView, b: ArrayBuffer | ArrayBufferView) => {
  const left = Buffer.from(ArrayBuffer.isView(a) ? a.buffer.slice(a.byteOffset, a.byteOffset + a.byteLength) : a);
  const right = Buffer.from(ArrayBuffer.isView(b) ? b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) : b);
  return left.length === right.length && timingSafeEqual(left, right);
};

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

  const agents: ActorHost<ThreadRuntime> = actorHost(dir ? join(dir, "actors", "agents") : null, (state) => new ThreadRuntime(state, env));
  const office: ActorHost<OfficePresenceCore> = actorHost(dir ? join(dir, "actors", "office") : null, (state) => new OfficePresenceCore(state, env));
  const indexer: ActorHost<KnowledgeIndexerCore> = actorHost(dir ? join(dir, "actors", "indexer") : null, (state) => new KnowledgeIndexerCore(state, env));
  Object.assign(env, { AGENTS: agents, OFFICE: office, INDEXER: indexer });

  return {
    env,
    hub,
    rearm: () => agents.rearm() + office.rearm() + indexer.rearm(),
    close() {
      hub.closeAll();
      agents.close();
      office.close();
      indexer.close();
      hostDb.close();
      void (local ? local.pglite.close() : options.sql?.close?.());
    },
  };
}
