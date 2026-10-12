import { resolve } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";

process.env.CONTACT_RATE_LIMIT_SECRET ??= "test-only-contact-rate-limit-secret-32";
// Marks the content database as configured; the PGlite instance below is what gets queried.
process.env.DATABASE_URL ??= "postgres://test.invalid/test";

/**
 * In-memory Postgres with the real migrations applied, installed as the server package's
 * database. Tests need no external service and exercise the same SQL as production.
 */
export async function useTestDatabase() {
  const server = await import("@ugur/server");
  const client = new PGlite();
  const db = drizzle(client, { schema: server.schema });
  await migrate(db, { migrationsFolder: resolve(import.meta.dirname, "../../packages/server/drizzle") });
  server.setDb(db as unknown as import("@ugur/server").Database);
  return {
    server,
    async close() {
      server.setDb(undefined);
      await client.close();
    },
  };
}
