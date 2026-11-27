import type { Env } from "../env.ts";
import type { ActorDirectory, ActorStatePort, SqlValue } from "../platform/ports.ts";
import type { AgentRuntime } from "./agent-object.ts";
import type { LiveHub } from "./hub-object.ts";
import type { KnowledgeIndexer } from "./indexer-object.ts";
import type { OfficePresence } from "./presence-object.ts";
import type { Workstation } from "./workstation-object.ts";

type PortKeys = "DB" | "CONFIG" | "FILES" | "AI" | "KNOWLEDGE" | "AGENTS" | "HUB" | "OFFICE" | "INDEXER" | "WORKSTATION";

/** The bindings wrangler.jsonc declares, with Cloudflare's own types. Only this folder sees them (ADR 0040). */
export interface CloudflareBindings extends Omit<Env, PortKeys> {
  DB: D1Database;
  CONFIG: KVNamespace;
  FILES: R2Bucket;
  AI: Ai;
  KNOWLEDGE: VectorizeIndex;
  AGENTS: DurableObjectNamespace<AgentRuntime>;
  HUB: DurableObjectNamespace<LiveHub>;
  OFFICE: DurableObjectNamespace<OfficePresence>;
  INDEXER: DurableObjectNamespace<KnowledgeIndexer>;
  WORKSTATION?: DurableObjectNamespace<Workstation>;
}

/** A Durable Object namespace as a directory of actors by name. */
function directory<T>(namespace: { idFromName(name: string): DurableObjectId; get(id: DurableObjectId): unknown }): ActorDirectory<T> {
  return { get: (name) => namespace.get(namespace.idFromName(name)) as unknown as T };
}

const built = new WeakMap<CloudflareBindings, Env>();

/**
 * The platform the core runs on, built from the bindings once per isolate. D1, KV, R2, Workers AI and Vectorize
 * already have the shape of their ports; Durable Object namespaces become directories.
 */
export function platformFrom(bindings: CloudflareBindings): Env {
  const known = built.get(bindings);
  if (known) return known;
  const env: Env = {
    ...bindings,
    DB: bindings.DB,
    CONFIG: bindings.CONFIG,
    FILES: bindings.FILES,
    AI: bindings.AI,
    KNOWLEDGE: bindings.KNOWLEDGE,
    AGENTS: directory(bindings.AGENTS),
    HUB: directory(bindings.HUB),
    OFFICE: directory(bindings.OFFICE),
    INDEXER: directory(bindings.INDEXER),
    WORKSTATION: bindings.WORKSTATION ? directory(bindings.WORKSTATION) : undefined,
  };
  built.set(bindings, env);
  return env;
}

/** A Durable Object's storage and its concurrency gate as the actor state of the core. */
export function actorState(ctx: DurableObjectState): ActorStatePort {
  const storage = ctx.storage;
  return {
    get: <T>(key: string) => storage.get<T>(key),
    put: <T>(key: string, value: T) => storage.put(key, value),
    delete: (keys: string | string[]) => (Array.isArray(keys) ? storage.delete(keys) : storage.delete(keys)),
    setAlarm: (at: number) => storage.setAlarm(at),
    deleteAlarm: () => storage.deleteAlarm(),
    sql: { exec: <T extends Record<string, SqlValue>>(query: string, ...bindings: unknown[]) => storage.sql.exec<T>(query, ...bindings) },
    blockConcurrencyWhile: (work) => ctx.blockConcurrencyWhile(work),
  };
}
