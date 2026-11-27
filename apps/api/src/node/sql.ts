import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { DatabaseSync, SQLInputValue } from "node:sqlite";
import type { SqlPort, SqlStatement } from "../platform/ports.ts";

/**
 * `SqlPort` on node:sqlite (ADR 0045, R1): the API's own SQL against a file or `:memory:`, with the migrations of
 * apps/api/migrations applied once each. It checks what D1 checks (placeholder count, one transaction per batch), so
 * a statement that would fail on Cloudflare fails here too. Local and in tests only; the shared database of the hosts
 * becomes Postgres (R2).
 */

/** Counts placeholders outside string literals and comments: each `?` is one, and `?1` used three times is still one. */
function placeholders(sql: string): number {
  const text = sql.replace(/'(?:[^']|'')*'/g, "''").replace(/\/\*[\s\S]*?\*\//g, "");
  const numbered = new Set([...text.matchAll(/\?(\d+)/g)].map((match) => match[1]));
  const plain = [...text.matchAll(/\?(?!\d)/g)].length;
  return plain + numbered.size;
}

/** node:sqlite rejects a numbered parameter used twice; expand every `?N` into its own positional `?`. */
function positional(sql: string, params: unknown[]): { sql: string; values: SQLInputValue[] } {
  const values: unknown[] = [];
  let next = 0;
  const expanded = sql.replace(/\?(\d*)/g, (_match, index: string) => {
    values.push(index ? params[Number(index) - 1] : params[next++]);
    return "?";
  });
  return { sql: expanded, values: values.map((value) => (value === undefined ? null : value)) as SQLInputValue[] };
}

/** Adds the failing statement to SQLite's error, which names only the problem. */
function explain<T>(sql: string, action: () => T): T {
  try {
    return action();
  } catch (error) {
    throw new Error(`${error instanceof Error ? error.message : String(error)} in: ${sql.replace(/\s+/g, " ").slice(0, 160)}`);
  }
}

/** Applies every migration not yet recorded in `_migrations`; a fresh database gets all of them. */
export function applyMigrations(db: DatabaseSync, dir: string): string[] {
  db.exec("CREATE TABLE IF NOT EXISTS _migrations (name TEXT PRIMARY KEY, applied_at INTEGER NOT NULL)");
  const done = new Set((db.prepare("SELECT name FROM _migrations").all() as { name: string }[]).map((row) => row.name));
  const applied: string[] = [];
  for (const file of readdirSync(dir).filter((name) => name.endsWith(".sql")).sort()) {
    if (done.has(file)) continue;
    db.exec("BEGIN");
    try {
      db.exec(readFileSync(join(dir, file), "utf8"));
      db.prepare("INSERT INTO _migrations (name, applied_at) VALUES (?, ?)").run(file, Date.now());
      db.exec("COMMIT");
    } catch (error) {
      db.exec("ROLLBACK");
      throw new Error(`Migration ${file}: ${error instanceof Error ? error.message : String(error)}`);
    }
    applied.push(file);
  }
  return applied;
}

export type SqliteStatement = SqlStatement & { sql: string; params: unknown[] };

export interface SqliteSql extends SqlPort {
  raw: DatabaseSync;
  prepare(query: string): SqliteStatement;
}

export function sqliteSql(db: DatabaseSync): SqliteSql {
  const statement = (sql: string, params: unknown[] = []): SqliteStatement => {
    const prepare = () => {
      // D1 rejects a statement whose placeholder count differs from the number of bound values.
      if (placeholders(sql) !== params.length) {
        throw new Error(`D1_ERROR: Wrong number of parameter bindings for SQL query. (${placeholders(sql)} placeholders, ${params.length} values)`);
      }
      const expanded = positional(sql, params);
      return { query: db.prepare(expanded.sql), values: expanded.values };
    };
    return {
      bind: (...next: unknown[]) => statement(sql, next),
      first: async <T>() =>
        explain(sql, () => {
          const { query, values } = prepare();
          return (query.get(...values) as T | undefined) ?? null;
        }),
      all: async <T>() =>
        explain(sql, () => {
          const { query, values } = prepare();
          return { results: query.all(...values) as T[] };
        }),
      run: async () =>
        explain(sql, () => {
          const { query, values } = prepare();
          return { meta: { changes: Number(query.run(...values).changes) } };
        }),
      sql,
      params,
    };
  };

  return {
    raw: db,
    prepare: (sql: string) => statement(sql),
    // D1 runs a batch as one transaction.
    batch: async (statements: SqlStatement[]) => {
      db.exec("BEGIN");
      try {
        const results: { meta: { changes: number } }[] = [];
        for (const item of statements) results.push(await item.run());
        db.exec("COMMIT");
        return results;
      } catch (error) {
        db.exec("ROLLBACK");
        throw error;
      }
    },
  };
}
