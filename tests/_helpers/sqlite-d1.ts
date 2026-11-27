import { resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { applyMigrations, sqliteSql } from "../../apps/api/src/node/sql.ts";

const migrations = resolve(import.meta.dirname, "../../apps/api/migrations");

/**
 * A D1 look-alike on real SQLite with every migration applied: the Node host's own SQL adapter (ADR 0045) in memory.
 * Routes run their actual SQL against it, so wrong column lists, missing tenant filters and placeholder/binding
 * mismatches fail here instead of on Cloudflare.
 */
export function sqliteD1() {
  const db = new DatabaseSync(":memory:");
  applyMigrations(db, migrations);
  return sqliteSql(db);
}
