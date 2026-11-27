import { createHmac, generateKeyPairSync, timingSafeEqual } from "node:crypto";
import { vi } from "vitest";
import api from "../../apps/api/src/index.ts";
import type { Env } from "../../apps/api/src/env.ts";
import { pgliteSql } from "../../apps/api/src/node/postgres.ts";
import { sqliteD1 } from "./sqlite-d1.ts";

// Workers add timingSafeEqual to crypto.subtle; Node has it on the crypto module only.
(crypto.subtle as unknown as { timingSafeEqual?: unknown }).timingSafeEqual ??= (a: ArrayBuffer, b: ArrayBuffer) => timingSafeEqual(Buffer.from(a), Buffer.from(b));

const pair = generateKeyPairSync("rsa", { modulusLength: 2048 });
export const APP_PRIVATE_KEY = pair.privateKey.export({ type: "pkcs1", format: "pem" }).toString();
export const SERVICE_TOKEN = "service-token";
export const WEBHOOK_SECRET = "webhook-secret";

/** The API's real fetch handler on real SQLite, with in-memory KV and stubbed Durable Objects. */
export function apiHarness(extra: Record<string, unknown> = {}) {
  // API_TEST_SQL=postgres runs the same tests on Postgres (PGlite) instead of SQLite (ADR 0045, R2).
  const port = process.env.API_TEST_SQL === "postgres" ? pgliteSql() : sqliteD1();
  // Test data and checks through the port, so a test runs on either database.
  const db = Object.assign(port, {
    exec: async (sql: string) => {
      for (const statement of sql.split(";").map((part) => part.trim()).filter(Boolean)) await port.prepare(statement).run();
    },
    one: <T = Record<string, unknown>>(sql: string) => port.prepare(sql).first<T>(),
    rows: async <T = Record<string, unknown>>(sql: string) => (await port.prepare(sql).all<T>()).results,
  });
  const kv = new Map<string, string>();
  const env = {
    API_SERVICE_TOKEN: SERVICE_TOKEN,
    API_ENV: "test",
    DEFAULT_REPO: "devUgur/uguroezdamar.com",
    GITHUB_OWNERS: "devUgur",
    STORAGE: { d1: "test", d1Region: "test", kv: "test", r2: "test" },
    DB: db,
    CONFIG: {
      get: async (key: string) => kv.get(key) ?? null,
      put: async (key: string, value: string) => void kv.set(key, value),
      delete: async (key: string) => void kv.delete(key),
    },
    AGENTS: { get: () => ({}) },
    OFFICE: { get: () => ({ recordEvent: async () => undefined }) },
    HUB: { get: () => ({ broadcast: async () => undefined }) },
    ...extra,
  } as unknown as Env;

  async function request(path: string, init: { method?: string; body?: unknown; headers?: Record<string, string>; auth?: boolean; raw?: string } = {}) {
    const response = await api.fetch(
      new Request(`https://api.test${path}`, {
        method: init.method ?? "GET",
        redirect: "manual",
        headers: {
          ...(init.auth === false ? {} : { authorization: `Bearer ${SERVICE_TOKEN}`, "x-portal-actor": "test" }),
          "content-type": "application/json",
          ...init.headers,
        },
        body: init.raw ?? (init.body === undefined ? undefined : JSON.stringify(init.body)),
      }),
      env,
      {} as ExecutionContext,
    );
    const text = await response.text();
    let body: unknown = text;
    try {
      body = JSON.parse(text);
    } catch {
      // Redirects and empty answers have no JSON body.
    }
    return { status: response.status, body: body as never, location: response.headers.get("location") };
  }
  return { env, db, kv, request };
}

/** GitHub's signature header for a webhook body. */
export function sign(body: string, secret = WEBHOOK_SECRET): string {
  return `sha256=${createHmac("sha256", secret).update(body).digest("hex")}`;
}

/** Plays GitHub for the connect flow and records the calls. */
export function stubGithubApp(options: { installation?: Record<string, unknown> | null } = {}) {
  const calls: { method: string; url: string }[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string | URL, init?: RequestInit) => {
      const url = String(input);
      calls.push({ method: init?.method ?? "GET", url });
      const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
      if (url.endsWith("/app")) return json({ slug: "my-agents" });
      if (/\/app\/installations\/\d+$/.test(url)) {
        return options.installation === null
          ? json({ message: "Not Found" }, 404)
          : json({ id: 42, account: { login: "acme-corp" }, repository_selection: "selected", suspended_at: null, ...options.installation });
      }
      return json({});
    }),
  );
  return calls;
}
