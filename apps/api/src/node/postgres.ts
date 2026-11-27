import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { PGlite } from "@electric-sql/pglite";
import type { SqlPort } from "../platform/ports.ts";
import { postgresSql, type PgClient } from "../postgres/sql.ts";
import { openPglite, pgliteClient } from "./pglite.ts";

/**
 * The API's Postgres on the Node host (ADR 0045, R2). The schema is the generated baseline
 * (apps/api/migrations-postgres); `_schema` records which file a database was created from, so a stale database is
 * reported instead of half-working.
 */
export const BASELINE = resolve(import.meta.dirname, "../../migrations-postgres/0000_baseline.sql");

export async function applyBaseline(client: PgClient, run: (sql: string) => Promise<unknown>): Promise<"created" | "current"> {
  const exists = await client.query("SELECT to_regclass('_schema') IS NOT NULL AS present", []);
  if (exists.rows[0]?.present) return "current";
  await run(readFileSync(BASELINE, "utf8"));
  await client.query("CREATE TABLE _schema (name TEXT PRIMARY KEY, applied_at BIGINT NOT NULL)", []);
  await client.query("INSERT INTO _schema (name, applied_at) VALUES ($1, $2)", ["0000_baseline.sql", String(Date.now())]);
  return "created";
}

/** A client that waits for its database: callers get a port at once, the first statement waits for the schema. */
function lazy(ready: Promise<PgClient>): PgClient {
  return {
    query: async (text, params) => (await ready).query(text, params),
    transaction: async (work) => (await ready).transaction(work),
  };
}

/** PGlite with the baseline applied: in memory (`dataDir` undefined) or in a folder of the Node host. */
export function pgliteSql(dataDir?: string): SqlPort & { pglite: PGlite; ready: Promise<PgClient> } {
  const pglite = openPglite(dataDir);
  const client = pgliteClient(pglite);
  const ready = applyBaseline(client, (sql) => pglite.exec(sql)).then(() => client);
  return { ...postgresSql(lazy(ready)), pglite, ready };
}
