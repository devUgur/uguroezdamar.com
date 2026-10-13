import { configDefaults, defineConfig, type Plugin } from 'vitest/config';
import { resolve, sep } from 'node:path';

const rootDir = import.meta.dirname;
const posix = (path: string) => path.split(sep).join('/');
const appsDir = posix(resolve(rootDir, 'apps'));

/** `@/…` is app-local, as in each app's tsconfig: it resolves inside the importing file's app. */
const appLocalAlias: Plugin = {
  name: 'app-local-alias',
  enforce: 'pre',
  async resolveId(source, importer, options) {
    if (!source.startsWith('@/') || !importer) return null;
    const file = posix(importer);
    if (!file.startsWith(`${appsDir}/`)) return null;
    const app = file.slice(appsDir.length + 1).split('/')[0];
    if (!app) return null;
    return this.resolve(resolve(appsDir, app, source.slice(2)), importer, { ...options, skipSelf: true });
  },
};

export default defineConfig({
  plugins: [appLocalAlias],
  test: {
    environment: 'node',
    globals: true,
    // Agent worktrees under .claude/ are full checkouts with their own tests.
    exclude: [...configDefaults.exclude, '.claude/**'],
    // The first test of a file pays for importing Next and booting in-memory Postgres.
    testTimeout: 40_000,
    hookTimeout: 30_000,
  },
  resolve: {
    // Workspace packages resolve through their own `exports` to TypeScript source: no build first.
    alias: {
      'server-only': resolve(rootDir, 'tests', '_stubs', 'server-only.js'),
    },
  },
});
