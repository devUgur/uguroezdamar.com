import type { ChatMessage, ToolCall } from "../models/port.ts";
import type { ActorStatePort, SqlPort } from "../platform/ports.ts";

/**
 * Where a thread keeps its state, and how it is woken for its next stage (ADR 0045, R3). `ThreadRuntime` only knows
 * these two ports. On Cloudflare a Durable Object's storage and alarm implement them (`actorThread`); on the Node
 * host shared SQL does (`sqlThread`), so any host can continue any thread.
 */
export interface StoredMessage extends ChatMessage {
  id: number;
}

export interface ThreadStorePort {
  /** Keyed values of the thread: run, inbox, summary, private mark. JSON-safe. */
  get<T>(key: string): Promise<T | undefined>;
  put<T>(key: string, value: T): Promise<void>;
  delete(keys: string | string[]): Promise<void>;
  messages: {
    append(message: ChatMessage): Promise<void>;
    /** The id the next appended message gets. */
    nextId(): Promise<number>;
    /** The last `limit` messages, oldest first. */
    recent(limit: number): Promise<StoredMessage[]>;
    /** Every message from `from` on, plus the `prior` messages before it; oldest first. */
    window(from: number, prior: number): Promise<StoredMessage[]>;
    /** Messages with `after < id < before`, oldest first. */
    between(after: number, before: number): Promise<StoredMessage[]>;
    clear(): Promise<void>;
  };
}

export interface SchedulerPort {
  /** Continue the thread at `at` (epoch ms); a later call replaces the time. */
  wakeAt(at: number): Promise<void>;
  cancel(): Promise<void>;
}

export interface ThreadHost {
  store: ThreadStorePort;
  scheduler: SchedulerPort;
}

interface MessageRow {
  [key: string]: string | number | null;
  id: number;
  role: string;
  content: string | null;
  tool_calls: string | null;
  tool_call_id: string | null;
  raw: string | null;
}

function toMessage(row: MessageRow): StoredMessage {
  return {
    id: Number(row.id),
    role: row.role as ChatMessage["role"],
    content: row.content,
    toolCalls: row.tool_calls ? (JSON.parse(row.tool_calls) as ToolCall[]) : undefined,
    toolCallId: row.tool_call_id ?? undefined,
    raw: row.raw ? (JSON.parse(row.raw) as ChatMessage["raw"]) : undefined,
  };
}

function columnsOf(message: ChatMessage): [string, string | null, string | null, string | null, string | null] {
  return [
    message.role,
    message.content,
    message.toolCalls ? JSON.stringify(message.toolCalls) : null,
    message.toolCallId ?? null,
    message.raw ? JSON.stringify(message.raw) : null,
  ];
}

/** A Durable Object (or any actor) as thread host: its storage, its own SQLite and its alarm, as before R3. */
export function actorThread(state: ActorStatePort): ThreadHost {
  state.sql.exec(`CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    role TEXT NOT NULL,
    content TEXT,
    tool_calls TEXT,
    tool_call_id TEXT,
    ts INTEGER NOT NULL
  )`);
  // Added with native provider adapters (ADR 0033); older threads get the column on first start.
  const columns = state.sql.exec<{ name: string }>("SELECT name FROM pragma_table_info('messages')").toArray();
  if (!columns.some((column) => column.name === "raw")) state.sql.exec("ALTER TABLE messages ADD COLUMN raw TEXT");
  const rows = (query: string, ...bindings: unknown[]) => state.sql.exec<MessageRow>(query, ...bindings).toArray().map(toMessage);
  const SELECT = "SELECT id, role, content, tool_calls, tool_call_id, raw FROM messages";
  return {
    store: {
      get: (key) => state.get(key),
      put: (key, value) => state.put(key, value),
      delete: async (keys) => void (await state.delete(keys)),
      messages: {
        append: async (message) => {
          state.sql.exec("INSERT INTO messages (role, content, tool_calls, tool_call_id, raw, ts) VALUES (?, ?, ?, ?, ?, ?)", ...columnsOf(message), Date.now());
        },
        nextId: async () => Number(state.sql.exec<{ next: number }>("SELECT COALESCE(MAX(id), 0) + 1 AS next FROM messages").one().next),
        recent: async (limit) => rows(`${SELECT} ORDER BY id DESC LIMIT ?`, limit).reverse(),
        window: async (from, prior) => rows(`${SELECT} WHERE id >= ? OR id IN (SELECT id FROM messages WHERE id < ? ORDER BY id DESC LIMIT ?) ORDER BY id`, from, from, prior),
        between: async (after, before) => rows(`${SELECT} WHERE id > ? AND id < ? ORDER BY id`, after, before),
        clear: async () => void state.sql.exec("DELETE FROM messages"),
      },
    },
    scheduler: {
      wakeAt: (at) => state.setAlarm(at),
      cancel: () => state.deleteAlarm(),
    },
  };
}

/** The tenant a thread's actor name belongs to (tenancy.ts: `thread:<id>` is the owner's, `t:<tenant>:thread:<id>`). */
export function tenantOfThread(key: string): string {
  return key.match(/^t:([^:]+):thread:/)?.[1] ?? "owner";
}

/**
 * A thread in shared SQL (migration 0032): messages in `thread_messages`, values in `thread_values`, its wake-up in
 * `scheduled_jobs`, all keyed by the actor name. `onWake` lets a host react at once to a wake-up that is due now.
 */
export function sqlThread(db: SqlPort, key: string, onWake?: (at: number) => void): ThreadHost {
  const tenant = tenantOfThread(key);
  const SELECT = "SELECT id, role, content, tool_calls, tool_call_id, raw FROM thread_messages WHERE tenant_id = ? AND thread_key = ?";
  const rows = async (query: string, ...bindings: unknown[]) => (await db.prepare(query).bind(...bindings).all<MessageRow>()).results.map(toMessage);
  return {
    store: {
      get: async <T>(name: string) => {
        const row = await db.prepare("SELECT value FROM thread_values WHERE tenant_id = ? AND thread_key = ? AND key = ?").bind(tenant, key, name).first<{ value: string }>();
        return row ? (JSON.parse(row.value) as T) : undefined;
      },
      put: async (name, value) => {
        await db
          .prepare("INSERT INTO thread_values (thread_key, key, tenant_id, value) VALUES (?, ?, ?, ?) ON CONFLICT(thread_key, key) DO UPDATE SET value = excluded.value")
          .bind(key, name, tenant, JSON.stringify(value))
          .run();
      },
      delete: async (names) => {
        for (const name of Array.isArray(names) ? names : [names]) {
          await db.prepare("DELETE FROM thread_values WHERE tenant_id = ? AND thread_key = ? AND key = ?").bind(tenant, key, name).run();
        }
      },
      messages: {
        append: async (message) => {
          await db
            .prepare(
              `INSERT INTO thread_messages (thread_key, id, tenant_id, role, content, tool_calls, tool_call_id, raw, ts)
               SELECT ?, COALESCE(MAX(id), 0) + 1, ?, ?, ?, ?, ?, ?, ? FROM thread_messages WHERE tenant_id = ? AND thread_key = ?`,
            )
            .bind(key, tenant, ...columnsOf(message), Date.now(), tenant, key)
            .run();
        },
        nextId: async () => {
          const row = await db.prepare("SELECT COALESCE(MAX(id), 0) + 1 AS next FROM thread_messages WHERE tenant_id = ? AND thread_key = ?").bind(tenant, key).first<{ next: number }>();
          return Number(row?.next ?? 1);
        },
        recent: async (limit) => (await rows(`${SELECT} ORDER BY id DESC LIMIT ?`, tenant, key, limit)).reverse(),
        window: (from, prior) =>
          rows(
            `${SELECT} AND (id >= ? OR id IN (SELECT id FROM thread_messages WHERE tenant_id = ? AND thread_key = ? AND id < ? ORDER BY id DESC LIMIT ?)) ORDER BY id`,
            tenant, key, from, tenant, key, from, prior,
          ),
        between: (after, before) => rows(`${SELECT} AND id > ? AND id < ? ORDER BY id`, tenant, key, after, before),
        clear: async () => void (await db.prepare("DELETE FROM thread_messages WHERE tenant_id = ? AND thread_key = ?").bind(tenant, key).run()),
      },
    },
    scheduler: {
      wakeAt: async (at) => {
        await db
          .prepare(
            `INSERT INTO scheduled_jobs (thread_key, tenant_id, due_at, version, updated_at) VALUES (?, ?, ?, 1, ?)
             ON CONFLICT(thread_key) DO UPDATE SET due_at = excluded.due_at, version = scheduled_jobs.version + 1, updated_at = excluded.updated_at`,
          )
          .bind(key, tenant, Math.round(at), Date.now())
          .run();
        onWake?.(at);
      },
      cancel: async () => void (await db.prepare("DELETE FROM scheduled_jobs WHERE tenant_id = ? AND thread_key = ?").bind(tenant, key).run()),
    },
  };
}
