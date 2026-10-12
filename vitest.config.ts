import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';

const rootDir = import.meta.dirname;

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    // The first test of a file pays for importing Next and booting in-memory Postgres.
    testTimeout: 40_000,
    hookTimeout: 30_000,
  },
  resolve: {
    alias: {
      '@': resolve(rootDir),
      'server-only': resolve(rootDir, 'tests', '_stubs', 'server-only.js'),
      '@ugur/server': resolve(rootDir, 'packages/server/dist/index.js'),
      '@ugur/core': resolve(rootDir, 'packages/core/dist/index.js'),
    },
  },
});
