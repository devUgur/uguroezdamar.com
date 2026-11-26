import { readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { DatabaseSync, type SQLInputValue } from "node:sqlite";

const migrations = resolve(import.meta.dirname, "../../apps/api/migrations");

/** Counts placeholders outside string literals and comments: each `?` is one, and `?1` used three times is still one. */
function placeholders(sql: string): number {
  const text = sql.replace(/'(?:[^']|'')*'/g, "''").replace(/\/\*[\s\S]*?\*\//g, "");
  const numbered = new Set([...text.matchAll(/\?(\d+)/g)].map((match) => match[1]));
  const plain = [...text.matchAll(/\?(?!\d)/g)].length;
  return plain + numbered.size;
}

/**
 * A D1 look-alike on real SQLite with every migration applied. Routes run their actual SQL against it, so
 * wrong column lists, missing tenant filters and placeholder/binding mismatches fail here instead of on Cloudflare.
 */
/** node:sqlite rejects a numbered parameter used twice; expand every `?N` into its own positional `?` with the value it names. */
function positional(sql: string, params: unknown[]): { sql: string; values: unknown[] } {
  const values: unknown[] = [];
  let next = 0;
  const expanded = sql.replace(/\?(\d*)/g, (_match, index: string) => {
    values.push(index ? params[Number(index) - 1] : params[next++]);
    return "?";
  });
  return { sql: expanded, values };
}

/** Adds the failing statement to SQLite's error, which names only the problem. */
function explain<T>(sql: string, action: () => T): T {
  try {
    return action();
  } catch (error) {
    throw new Error(`${error instanceof Error ? error.message : String(error)} in: ${sql.replace(/\s+/g, " ").slice(0, 160)}`);
  }
}

export function sqliteD1() {
  const db = new DatabaseSync(":memory:");
  for (const file of readdirSync(migrations).sort()) db.exec(readFileSync(join(migrations, file), "utf8"));

  const statement = (sql: string, params: unknown[] = []) => {
    const run = () => {
      // D1 rejects a statement whose placeholder count differs from the number of bound values.
      if (placeholders(sql) !== params.length) {
        throw new Error(`D1_ERROR: Wrong number of parameter bindings for SQL query. (${placeholders(sql)} placeholders, ${params.length} values)`);
      }
      return db.prepare(positional(sql, params).sql);
    };
    const values = () => positional(sql, params).values.map((value) => (value === undefined ? null : value)) as SQLInputValue[];
    return {
      bind: (...next: unknown[]) => statement(sql, next),
      first: async () => explain(sql, () => (run().get(...values()) as never) ?? null),
      all: async () => explain(sql, () => ({ results: run().all(...values()) as never[] })),
      run: async () => explain(sql, () => ({ meta: { changes: Number(run().run(...values()).changes) } })),
      sql,
      params,
    };
  };

  return {
    raw: db,
    prepare: (sql: string) => statement(sql),
    batch: async (statements: ReturnType<typeof statement>[]) => {
      const results = [];
      for (const item of statements) results.push(await item.run());
      return results;
    },
  };
}
