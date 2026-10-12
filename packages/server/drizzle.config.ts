import { defineConfig } from "drizzle-kit";

// `generate` and `check` work offline. `migrate` and `studio` need the direct (non-pooled)
// connection, injected by `pnpm ugur db <cmd>` from Infisical.
const url = process.env.DATABASE_URL_DIRECT;

export default defineConfig({
	dialect: "postgresql",
	schema: "./src/db/schema.ts",
	out: "./drizzle",
	strict: true,
	...(url ? { dbCredentials: { url } } : {}),
});
