import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { BASELINE } from "../apps/api/src/node/postgres.ts";
import { postgresBaseline } from "../apps/api/src/node/pg-schema.ts";
import { toPostgres } from "../apps/api/src/postgres/dialect.ts";

/** ADR 0045, R2: the API's SQLite SQL on Postgres. `pnpm test:pg` runs the API tests themselves on PGlite. */
describe("SQLite to Postgres", () => {
  it("numbers placeholders and repeats a value used twice", () => {
    expect(toPostgres("SELECT * FROM t WHERE a = ? AND b = ?2 AND c = ?")).toEqual({ text: "SELECT * FROM t WHERE a = $1 AND b = $2 AND c = $3", sources: [0, 1, 1] });
  });

  it("translates the functions the API uses and leaves literals alone", () => {
    expect(toPostgres("UPDATE t SET at = unixepoch(), note = 'unixepoch() ?' WHERE id = ?").text).toBe(
      "UPDATE t SET at = CAST(EXTRACT(EPOCH FROM now()) AS BIGINT), note = 'unixepoch() ?' WHERE id = $1",
    );
    expect(toPostgres("SELECT json_object('a', x) AS data, MAX(a, COALESCE(?, a)) AS top, MAX(b) AS most FROM t").text).toBe(
      "SELECT json_build_object('a', x) AS data, GREATEST(a, COALESCE($1, a)) AS top, MAX(b) AS most FROM t",
    );
    expect(toPostgres("SELECT x FROM t WHERE name LIKE ? AND (? IS NULL OR p = ?)").text).toBe("SELECT x FROM t WHERE name ILIKE $1 AND (CAST($2 AS TEXT) IS NULL OR p = $3)");
  });

  it("turns INSERT OR IGNORE into ON CONFLICT DO NOTHING, before RETURNING", () => {
    expect(toPostgres("INSERT OR IGNORE INTO t (a) VALUES (?)").text).toBe("INSERT INTO t (a) VALUES ($1) ON CONFLICT DO NOTHING");
    expect(toPostgres("INSERT OR IGNORE INTO t (a) VALUES (?) RETURNING id").text).toBe("INSERT INTO t (a) VALUES ($1) ON CONFLICT DO NOTHING RETURNING id");
  });

  it("keeps camelCase aliases as written", () => {
    expect(toPostgres("SELECT updated_at AS updatedAt FROM t ORDER BY updatedAt").text).toBe('SELECT updated_at AS "updatedAt" FROM t ORDER BY "updatedAt"');
  });

  it("keeps the generated Postgres schema current with the SQLite migrations", () => {
    // Stale? `pnpm --filter @ugur/node-host pg:schema` writes it again.
    expect(readFileSync(BASELINE, "utf8").replace(/\r\n/g, "\n")).toBe(postgresBaseline(resolve(import.meta.dirname, "../apps/api/migrations")));
  });
});
