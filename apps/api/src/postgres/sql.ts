import type { SqlPort, SqlStatement } from "../platform/ports.ts";
import { toPostgres } from "./dialect.ts";

/**
 * `SqlPort` on PostgreSQL (ADR 0045, R2), for any driver: PGlite (tests, local without Docker), postgres.js
 * (Docker, Neon) and later the Worker's driver. The core keeps writing SQLite SQL; `dialect.ts` translates it.
 *
 * Values go to Postgres untyped, as text, so the server types each parameter from where it stands; the SQLite
 * habits of the code (numbers for flags, text for ids) keep working. Results come back as plain JS values:
 * BIGINT and NUMERIC as numbers, like D1 returns them.
 */
export interface PgClient {
  query(text: string, params: (string | null)[]): Promise<{ rows: Record<string, unknown>[]; count: number }>;
  /** Runs `work` in one transaction on one connection. */
  transaction<T>(work: (client: PgClient) => Promise<T>): Promise<T>;
}

function wire(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "boolean") return value ? "1" : "0";
  if (value instanceof ArrayBuffer || ArrayBuffer.isView(value)) throw new Error("Binärwerte sind im Postgres-Adapter noch nicht vorgesehen.");
  return String(value);
}

function statement(client: () => PgClient, sql: string, params: unknown[] = []): SqlStatement & { execute(on: PgClient): Promise<{ rows: Record<string, unknown>[]; count: number }> } {
  const execute = (on: PgClient) => {
    const translated = toPostgres(sql);
    return on.query(translated.text, translated.sources.map((source) => wire(params[source])));
  };
  return {
    bind: (...next: unknown[]) => statement(client, sql, next),
    first: async <T>(column?: string) => {
      const { rows } = await execute(client());
      const row = rows[0];
      if (!row) return null;
      return (column ? (row[column] as T) : (row as T)) ?? null;
    },
    all: async <T>() => ({ results: (await execute(client())).rows as T[] }),
    run: async () => ({ meta: { changes: (await execute(client())).count } }),
    execute,
  };
}

export function postgresSql(client: PgClient): SqlPort {
  return {
    prepare: (sql: string) => statement(() => client, sql),
    // D1 runs a batch as one transaction; so does Postgres here.
    batch: (statements: SqlStatement[]) =>
      client.transaction(async (inner) => {
        const results: { meta: { changes: number } }[] = [];
        for (const item of statements) {
          const runnable = item as SqlStatement & { execute?: (on: PgClient) => Promise<{ count: number }> };
          if (!runnable.execute) throw new Error("Ein Batch nimmt nur Anweisungen desselben Adapters.");
          results.push({ meta: { changes: (await runnable.execute(inner)).count } });
        }
        return results;
      }),
  };
}
