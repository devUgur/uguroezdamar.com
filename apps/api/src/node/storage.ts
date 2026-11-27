import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve, sep } from "node:path";
import type { DatabaseSync } from "node:sqlite";
import type { BlobPort, InferencePort, KeyValuePort, VectorIndexPort } from "../platform/ports.ts";

/**
 * The smaller ports of the Node host (ADR 0045, R1): configuration values in the host's SQLite, files on disk, and
 * honest stand-ins for what has no local counterpart yet (vectors, Workers AI).
 */

/** KV with lifetimes in a table of the host's own database. */
export function sqliteKeyValue(db: DatabaseSync): KeyValuePort {
  db.exec("CREATE TABLE IF NOT EXISTS host_kv (key TEXT PRIMARY KEY, value TEXT NOT NULL, expires_at INTEGER)");
  const read = (key: string): string | null => {
    const row = db.prepare("SELECT value, expires_at FROM host_kv WHERE key = ?").get(key) as { value: string; expires_at: number | null } | undefined;
    if (!row) return null;
    if (row.expires_at !== null && row.expires_at <= Date.now()) {
      db.prepare("DELETE FROM host_kv WHERE key = ?").run(key);
      return null;
    }
    return row.value;
  };
  return {
    get: (async (key: string, type?: "json") => {
      const value = read(key);
      return value !== null && type === "json" ? JSON.parse(value) : value;
    }) as KeyValuePort["get"],
    put: async (key, value, options) => {
      const expires = options?.expirationTtl ? Date.now() + options.expirationTtl * 1000 : null;
      db.prepare("INSERT INTO host_kv (key, value, expires_at) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, expires_at = excluded.expires_at").run(key, value, expires);
    },
    delete: async (key) => {
      db.prepare("DELETE FROM host_kv WHERE key = ?").run(key);
    },
  };
}

/** Files under one directory; a key never leaves it. */
export function fileBlobs(root: string): BlobPort {
  const base = resolve(root);
  const pathOf = (key: string) => {
    const path = resolve(join(base, key));
    if (path !== base && !path.startsWith(base + sep)) throw new Error("Ungültiger Dateischlüssel.");
    return path;
  };
  return {
    get: async (key) => {
      try {
        const content = await readFile(pathOf(key), "utf8");
        return { text: async () => content };
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
        throw error;
      }
    },
    put: async (key, value) => {
      const path = pathOf(key);
      await mkdir(dirname(path), { recursive: true });
      await writeFile(path, typeof value === "string" ? value : Buffer.from(value));
    },
    delete: async (key) => {
      await rm(pathOf(key), { force: true });
    },
  };
}

/** Files in memory, for tests and throwaway runs. */
export function memoryBlobs(): BlobPort {
  const files = new Map<string, string>();
  return {
    get: async (key) => {
      const content = files.get(key);
      return content === undefined ? null : { text: async () => content };
    },
    put: async (key, value) => void files.set(key, typeof value === "string" ? value : Buffer.from(value).toString("utf8")),
    delete: async (key) => void files.delete(key),
  };
}

/** No local vector index yet (pgvector comes with Postgres, R2): searches find nothing, writes are dropped. */
export const noVectors: VectorIndexPort = {
  upsert: async () => ({ count: 0 }),
  deleteByIds: async () => ({ count: 0 }),
  query: async () => ({ matches: [] }),
};

/** Workers AI exists only on Cloudflare; the knowledge index reports this instead of guessing. */
export const noInference: InferencePort = {
  run: async (model) => {
    throw new Error(`Workers AI (${model}) ist auf dem Node-Host nicht verfügbar.`);
  },
};
