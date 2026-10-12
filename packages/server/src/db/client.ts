import "server-only";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { env } from "../env";
import * as schema from "./schema";

/** Any Drizzle Postgres database with our schema: postgres.js at runtime, PGlite in tests. */
export type Database = PgDatabase<PgQueryResultHKT, typeof schema>;

type GlobalWithDb = typeof globalThis & { __ugurDb?: Database };
const g = globalThis as GlobalWithDb;

/** Thrown when no connection string is configured, so callers can tell it apart from "no rows". */
export class DatabaseNotConfiguredError extends Error {
	constructor() {
		super("DATABASE_URL is not set. Start the app with `pnpm dev` or `pnpm ugur secrets run`.");
		this.name = "DatabaseNotConfiguredError";
	}
}

/**
 * One client per server process. `prepare: false` keeps it compatible with Neon's pooled
 * (PgBouncer) endpoint, which is what DATABASE_URL points at.
 */
export function getDb(): Database {
	if (g.__ugurDb) return g.__ugurDb;
	if (!env.DATABASE_URL) throw new DatabaseNotConfiguredError();
	const client = postgres(env.DATABASE_URL, {
		max: 5,
		idle_timeout: 20,
		connect_timeout: 10,
		prepare: false,
	});
	g.__ugurDb = drizzle(client, { schema });
	return g.__ugurDb;
}

/** Replaces the process-wide database, e.g. with an in-memory PGlite instance in tests. */
export function setDb(db: Database | undefined) {
	g.__ugurDb = db;
}

/** A copy of `row` without one column, e.g. a credential or an internal marker. */
export function omit<T extends object, K extends keyof T>(row: T, key: K): Omit<T, K> {
	const copy = { ...row };
	delete copy[key];
	return copy;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Postgres rejects a malformed uuid with an error; ids taken from URLs are checked first. */
export function isUuid(value: string): boolean {
	return UUID.test(value);
}

/**
 * A loggable one-liner for a failed query: driver error code and message, with anything that
 * looks like a connection string removed. Callers log this instead of dropping the cause.
 */
export function describeDbError(error: unknown): string {
	const { name, code, message } = (error ?? {}) as { name?: string; code?: string; message?: string };
	const text = String(message ?? error).replace(/postgres(ql)?:\/\/\S+/gi, "<connection string>");
	return [name, code, text].filter(Boolean).join(" · ");
}
