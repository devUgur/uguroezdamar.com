import postgres from "postgres";
import { applyBaseline } from "../../api/src/node/postgres.ts";
import { postgresSql, type PgClient } from "../../api/src/postgres/sql.ts";
import type { SqlPort } from "../../api/src/platform/ports.ts";

/**
 * The API's Postgres through postgres.js (ADR 0045, R2): Postgres in Docker locally, Neon in the cloud (R5).
 * BIGINT and NUMERIC come back as numbers, like D1 returns them; parameters go untyped, as text.
 */
function clientOf(sql: postgres.Sql | postgres.TransactionSql): PgClient {
  return {
    query: async (text, params) => {
      const result = await sql.unsafe(text, params as string[]);
      return { rows: [...result] as Record<string, unknown>[], count: result.count };
    },
    transaction: async (work) => (await (sql as postgres.Sql).begin((tx) => work(clientOf(tx)))) as never,
  };
}

export async function postgresJsSql(url: string): Promise<SqlPort & { close(): Promise<void> }> {
  const sql = postgres(url, {
    max: 5,
    onnotice: () => undefined,
    types: { bigint: { to: 20, from: [20, 1700], serialize: (value: number) => String(value), parse: (value: string) => Number(value) } },
  });
  const client = clientOf(sql);
  await applyBaseline(client, (text) => sql.unsafe(text));
  return { ...postgresSql(client), close: () => sql.end() };
}
