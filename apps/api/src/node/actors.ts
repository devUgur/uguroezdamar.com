import { createHash } from "node:crypto";
import { mkdirSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import { deserialize, serialize } from "node:v8";
import type { ActorDirectory, ActorStatePort, SqlValue } from "../platform/ports.ts";

/**
 * Actors in the Node process (ADR 0045, R1), the counterpart of Durable Objects. One SQLite file per actor holds
 * its keyed values (`_kv`, structured clone like Durable Object storage), its own tables and its wake-up time
 * (`_alarm`). A timer replaces the alarm; when the host starts it re-arms every stored wake-up time.
 */
export interface HostedActor {
  alarm?(): Promise<void> | void;
}

interface Entry<T> {
  actor: T;
  db: DatabaseSync;
  timer?: NodeJS.Timeout;
  running: boolean;
}

function stateOf(db: DatabaseSync, wake: (at: number | null) => void): ActorStatePort {
  return {
    get: async <T>(key: string) => {
      const row = db.prepare("SELECT value FROM _kv WHERE key = ?").get(key) as { value: Uint8Array } | undefined;
      return row === undefined ? undefined : (deserialize(row.value) as T);
    },
    put: async <T>(key: string, value: T) => {
      db.prepare("INSERT INTO _kv (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").run(key, serialize(value));
    },
    delete: async (keys: string | string[]) => {
      for (const key of Array.isArray(keys) ? keys : [keys]) db.prepare("DELETE FROM _kv WHERE key = ?").run(key);
    },
    setAlarm: async (at: number) => {
      db.prepare("INSERT INTO _alarm (id, at) VALUES (1, ?) ON CONFLICT(id) DO UPDATE SET at = excluded.at").run(at);
      wake(at);
    },
    deleteAlarm: async () => {
      db.prepare("DELETE FROM _alarm").run();
      wake(null);
    },
    sql: {
      exec: <T extends Record<string, SqlValue>>(query: string, ...bindings: unknown[]) => {
        const statement = db.prepare(query);
        const values = bindings as SQLInputValue[];
        const rows =
          /^\s*(select|pragma|with)\b/i.test(query) || /\breturning\b/i.test(query) ? (statement.all(...values) as T[]) : (statement.run(...values), [] as T[]);
        return {
          toArray: () => rows,
          one: () => {
            const [row] = rows;
            if (!row) throw new Error("Keine Zeile.");
            return row;
          },
        };
      },
    },
    blockConcurrencyWhile: async (work) => work(),
  };
}

export interface ActorHost<T> extends ActorDirectory<T> {
  /** Re-arms the stored wake-up times; called once when the host starts. Returns how many were armed. */
  rearm(): number;
  /** Stops every timer and closes the files. */
  close(): void;
}

/**
 * A directory of actors of one kind under `dir`, or in memory when `dir` is null. `create` builds the actor from its
 * state, as a Durable Object class does from its storage.
 */
export function actorHost<T extends HostedActor>(dir: string | null, create: (state: ActorStatePort, name: string) => T): ActorHost<T> {
  if (dir) mkdirSync(dir, { recursive: true });
  const actors = new Map<string, Entry<T>>();
  const fileOf = (name: string) => `${createHash("sha256").update(name).digest("hex").slice(0, 24)}.sqlite`;

  // One alarm at a time per actor, as on Cloudflare; a wake-up set during a run fires after it.
  function schedule(entry: Entry<T>, at: number | null): void {
    if (entry.timer) clearTimeout(entry.timer);
    entry.timer = undefined;
    if (at === null || entry.running) return;
    entry.timer = setTimeout(() => void fire(entry), Math.max(0, at - Date.now()));
  }

  async function fire(entry: Entry<T>): Promise<void> {
    entry.timer = undefined;
    entry.db.prepare("DELETE FROM _alarm").run();
    entry.running = true;
    try {
      await entry.actor.alarm?.();
    } catch (error) {
      console.error("actor alarm failed", error);
    } finally {
      entry.running = false;
      const next = entry.db.prepare("SELECT at FROM _alarm").get() as { at: number } | undefined;
      if (next) schedule(entry, next.at);
    }
  }

  function open(name: string): Entry<T> {
    const known = actors.get(name);
    if (known) return known;
    const db = new DatabaseSync(dir ? join(dir, fileOf(name)) : ":memory:");
    db.exec("PRAGMA journal_mode = WAL");
    db.exec("CREATE TABLE IF NOT EXISTS _kv (key TEXT PRIMARY KEY, value BLOB NOT NULL)");
    db.exec("CREATE TABLE IF NOT EXISTS _alarm (id INTEGER PRIMARY KEY CHECK (id = 1), at INTEGER NOT NULL)");
    db.exec("CREATE TABLE IF NOT EXISTS _meta (name TEXT NOT NULL)");
    if (!db.prepare("SELECT 1 FROM _meta").get()) db.prepare("INSERT INTO _meta (name) VALUES (?)").run(name);
    const entry = { db, running: false } as Entry<T>;
    actors.set(name, entry);
    entry.actor = create(stateOf(db, (at) => schedule(entry, at)), name);
    return entry;
  }

  return {
    get: (name: string) => open(name).actor,
    rearm() {
      if (!dir) return 0;
      let armed = 0;
      for (const file of readdirSync(dir).filter((entry) => entry.endsWith(".sqlite"))) {
        let name: string | undefined;
        const probe = new DatabaseSync(join(dir, file), { readOnly: true });
        try {
          const alarm = probe.prepare("SELECT at FROM _alarm").get();
          if (alarm) name = (probe.prepare("SELECT name FROM _meta").get() as { name: string } | undefined)?.name;
        } catch {
          // Not an actor file.
        } finally {
          probe.close();
        }
        if (!name) continue;
        const entry = open(name);
        const at = (entry.db.prepare("SELECT at FROM _alarm").get() as { at: number } | undefined)?.at;
        if (at === undefined) continue;
        schedule(entry, at);
        armed += 1;
      }
      return armed;
    },
    close() {
      for (const entry of actors.values()) {
        if (entry.timer) clearTimeout(entry.timer);
        entry.db.close();
      }
      actors.clear();
    },
  };
}
