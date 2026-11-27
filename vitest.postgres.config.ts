import { defineConfig, mergeConfig } from "vitest/config";
import base from "./vitest.config.ts";

/**
 * The same tests with the agent API on Postgres (PGlite) instead of SQLite (ADR 0045, R2): `pnpm test:pg`. Only the
 * API's harness switches; everything else is unchanged. Fewer workers, since each harness boots its own Postgres.
 */
export default mergeConfig(
  base,
  defineConfig({
    test: {
      env: { API_TEST_SQL: "postgres" },
      include: ["tests/api-*.test.ts", "tests/platform-seams.test.ts", "tests/node-host.test.ts", "tests/*workflow*.test.ts", "tests/policy-engine.test.ts", "tests/office-*.test.ts"],
      maxWorkers: 4,
    },
  }),
);
