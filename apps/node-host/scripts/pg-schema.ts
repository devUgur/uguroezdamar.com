import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { postgresBaseline } from "../../api/src/node/pg-schema.ts";

/** Writes the Postgres baseline of the API from the SQLite migrations (ADR 0045, R2). */
const api = resolve(import.meta.dirname, "../../api");
const target = resolve(api, "migrations-postgres/0000_baseline.sql");
writeFileSync(target, postgresBaseline(resolve(api, "migrations")));
console.log(`[pg:schema] ${target}`);
