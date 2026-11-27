import { PGlite, types } from "@electric-sql/pglite";
import type { PgClient } from "../postgres/sql.ts";

/**
 * PGlite (Postgres in WebAssembly, in the process) as a `PgClient` (ADR 0045, R2): the Node host's database when no
 * DATABASE_URL is given, and the tests' Postgres. BIGINT and NUMERIC come back as numbers, like D1 returns them.
 */
export const NUMERIC_PARSERS = { [types.INT8]: (value: string) => Number(value), [types.NUMERIC]: (value: string) => Number(value) };

export function pgliteClient(db: PGlite): PgClient {
  const wrap = (target: Pick<PGlite, "query">): PgClient => ({
    query: async (text, params) => {
      const result = await target.query<Record<string, unknown>>(text, params);
      return { rows: result.rows, count: result.affectedRows ?? result.rows.length };
    },
    transaction: (work) => db.transaction((tx) => work(wrap(tx))),
  });
  return wrap(db);
}

export function openPglite(dataDir?: string): PGlite {
  return new PGlite(dataDir, { parsers: NUMERIC_PARSERS });
}
