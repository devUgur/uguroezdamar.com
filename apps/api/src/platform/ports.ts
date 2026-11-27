/**
 * The platform the agent core runs on (ADR 0040, phase P1). The core only knows these interfaces; Cloudflare
 * (apps/api/src/cloudflare/) and later a Node host implement them. Shapes follow what the core already uses, so the
 * Cloudflare bindings satisfy them as they are and no query had to be rewritten.
 */

/** A value SQL can store. */
export type SqlValue = string | number | null | ArrayBuffer;

export interface SqlStatement {
  bind(...values: unknown[]): SqlStatement;
  first<T = Record<string, unknown>>(column?: string): Promise<T | null>;
  all<T = Record<string, unknown>>(): Promise<{ results: T[] }>;
  run(): Promise<{ meta: { changes: number } }>;
}

/** Relational data in SQLite dialect (D1 on Cloudflare; node:sqlite or a translating adapter elsewhere). */
export interface SqlPort {
  prepare(query: string): SqlStatement;
  /** Runs all statements in one transaction. */
  batch(statements: SqlStatement[]): Promise<{ meta: { changes: number } }[]>;
}

/** Small values with an optional lifetime: configuration, one-time tickets, counters. */
export interface KeyValuePort {
  get(key: string): Promise<string | null>;
  get<T>(key: string, type: "json"): Promise<T | null>;
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>;
  delete(key: string): Promise<void>;
}

/** Files (Cloudflare R2, a directory or S3-compatible storage). */
export interface BlobPort {
  get(key: string): Promise<{ text(): Promise<string> } | null>;
  put(key: string, value: string | ArrayBuffer): Promise<unknown>;
  delete(key: string): Promise<void>;
}

/** Rows from an actor's own SQL. */
export interface SqlCursor<T> {
  toArray(): T[];
  one(): T;
}

/**
 * State of one actor (a conversation, the office, a knowledge index): keyed values, its own SQL and one wake-up
 * time. On Cloudflare this is a Durable Object's storage; a Node host keeps it in SQLite and a timer.
 */
export interface ActorStatePort {
  get<T>(key: string): Promise<T | undefined>;
  put<T>(key: string, value: T): Promise<void>;
  delete(keys: string | string[]): Promise<unknown>;
  setAlarm(at: number): Promise<void>;
  deleteAlarm(): Promise<void>;
  sql: { exec<T extends Record<string, SqlValue>>(query: string, ...bindings: unknown[]): SqlCursor<T> };
  /** Runs setup before any other call reaches the actor. */
  blockConcurrencyWhile<T>(work: () => Promise<T>): Promise<T>;
}

/** Finds the one actor with a given name (Durable Object namespace on Cloudflare). */
export interface ActorDirectory<T> {
  get(name: string): T;
}

/** Vectors of the knowledge index (Vectorize on Cloudflare; sqlite-vec or pgvector elsewhere). */
export interface VectorIndexPort {
  upsert(rows: { id: string; values: number[]; metadata?: Record<string, string> }[]): Promise<unknown>;
  deleteByIds(ids: string[]): Promise<unknown>;
  query(vector: number[], options: { topK: number; filter?: Record<string, string> }): Promise<{ matches: { id: string; score: number }[] }>;
}

/** A hosted model runner addressed by model name (Workers AI): chat for the router, embeddings for knowledge. */
export interface InferencePort {
  run(model: string, input: Record<string, unknown>): Promise<unknown>;
}
