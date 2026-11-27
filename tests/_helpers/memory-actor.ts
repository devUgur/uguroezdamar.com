import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import type { ActorStatePort, SqlValue } from "../../apps/api/src/platform/ports.ts";

/**
 * Actor state without Cloudflare (ADR 0040): keyed values in a Map, the actor's own SQL in node:sqlite and the
 * wake-up time as a field the test reads. The same contract a Node host implements with a file and a timer.
 */
export function memoryActorState() {
  const values = new Map<string, unknown>();
  const db = new DatabaseSync(":memory:");
  const clock = { alarm: null as number | null };
  const state: ActorStatePort = {
    get: async <T>(key: string) => values.get(key) as T | undefined,
    put: async <T>(key: string, value: T) => void values.set(key, structuredClone(value)),
    delete: async (keys: string | string[]) => {
      for (const key of Array.isArray(keys) ? keys : [keys]) values.delete(key);
    },
    setAlarm: async (at: number) => void (clock.alarm = at),
    deleteAlarm: async () => void (clock.alarm = null),
    sql: {
      exec: <T extends Record<string, SqlValue>>(query: string, ...bindings: unknown[]) => {
        const statement = db.prepare(query);
        const rows = /^\s*(select|pragma|with)\b/i.test(query) || /\breturning\b/i.test(query)
          ? (statement.all(...(bindings as SQLInputValue[])) as T[])
          : (statement.run(...(bindings as SQLInputValue[])), [] as T[]);
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
  return { state, values, clock, db };
}
