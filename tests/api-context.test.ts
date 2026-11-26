import { timingSafeEqual } from "node:crypto";
import { describe, expect, it } from "vitest";
import api from "../apps/api/src/index.ts";
import type { Env } from "../apps/api/src/env.ts";
import { ModelRouter } from "../apps/api/src/models/router.ts";
import { buildContext, PRIOR_MESSAGES, type StoredMessage, summaryPrompt, unsummarized } from "../apps/api/src/runtime/context.ts";
import { sqliteD1 } from "./_helpers/sqlite-d1.ts";

(crypto.subtle as unknown as { timingSafeEqual?: unknown }).timingSafeEqual ??= (a: ArrayBuffer, b: ArrayBuffer) => timingSafeEqual(Buffer.from(a), Buffer.from(b));

/** A long earlier conversation (ids 1–40, every third a tool round), then a run from id 41. */
function thread(): StoredMessage[] {
  const messages: StoredMessage[] = [];
  let id = 0;
  for (let round = 0; round < 10; round += 1) {
    messages.push({ id: ++id, role: "user", content: `Frage ${round}` });
    messages.push({ id: ++id, role: "assistant", content: null, toolCalls: [{ id: `c${round}`, name: "repo_read_file", arguments: "{}" }] });
    messages.push({ id: ++id, role: "tool", content: "x".repeat(5_000), toolCallId: `c${round}` });
    messages.push({ id: ++id, role: "assistant", content: `Antwort ${round}` });
  }
  messages.push({ id: ++id, role: "user", content: "Neuer Auftrag" });
  messages.push({ id: ++id, role: "assistant", content: null, toolCalls: [{ id: "run1", name: "repo_read_file", arguments: "{}" }] });
  messages.push({ id: ++id, role: "tool", content: "y".repeat(5_000), toolCallId: "run1" });
  return messages;
}

describe("context builder", () => {
  it("sends the current run whole, earlier runs as summary plus a short tail with cut tool results", () => {
    const context = buildContext(thread(), 41, { text: "Bisher: README gelesen.", upTo: 30 });
    expect(context[0]).toEqual({ role: "system", content: expect.stringContaining("Bisher: README gelesen.") });
    const tail = context.slice(1, -3);
    expect(tail.length).toBeLessThanOrEqual(PRIOR_MESSAGES);
    expect(tail[0]?.role).not.toBe("tool");
    expect(tail.filter((message) => message.role === "tool").every((message) => (message.content ?? "").length < 700)).toBe(true);
    expect(context.slice(-3).map((message) => message.role)).toEqual(["user", "assistant", "tool"]);
    expect(context.at(-1)?.content).toHaveLength(5_000);
    const chars = (messages: { content: string | null }[]) => messages.reduce((sum, message) => sum + (message.content ?? "").length, 0);
    // The old window sent the last 60 messages in full.
    expect(chars(context)).toBeLessThan(chars(thread().slice(-60)) / 2);
  });

  it("only summarizes what is neither summarized nor in the tail, and builds a bounded prompt", () => {
    const messages = thread();
    const pending = unsummarized(messages, 41, { text: "alt", upTo: 10 });
    expect(pending[0]?.id).toBe(11);
    expect(pending.at(-1)?.id).toBe(40 - PRIOR_MESSAGES);
    const prompt = summaryPrompt({ text: "alt", upTo: 10 }, pending);
    expect(prompt[0]?.role).toBe("system");
    expect(prompt[1]?.content).toContain("Bisherige Zusammenfassung:\nalt");
    expect(prompt[1]?.content).not.toContain("x".repeat(400));
    expect(unsummarized(messages.slice(0, 5), 5, null)).toEqual([]);
  });
});

function setup() {
  const db = sqliteD1();
  const env = {
    API_SERVICE_TOKEN: "service-token",
    API_ENV: "test",
    DEFAULT_REPO: "devUgur/uguroezdamar.com",
    GITHUB_OWNERS: "devUgur",
    STORAGE: { d1: "test", d1Region: "test", kv: "test", r2: "test" },
    DB: db,
    CONFIG: { get: async () => null },
    HUB: { idFromName: (name: string) => name, get: () => ({ broadcast: async () => undefined }) },
    OFFICE: { idFromName: (name: string) => name, get: () => ({ recordEvent: async () => undefined }) },
  } as unknown as Env;
  async function call(path: string, init: { method?: string; body?: unknown; scopes?: string } = {}) {
    const response = await api.fetch(
      new Request(`https://api.test${path}`, {
        method: init.method ?? "GET",
        headers: { authorization: "Bearer service-token", "content-type": "application/json", "x-portal-actor": "owner@test", ...(init.scopes ? { "x-portal-scopes": init.scopes } : {}) },
        body: init.body === undefined ? undefined : JSON.stringify(init.body),
      }),
      env,
      {} as ExecutionContext,
    );
    return { status: response.status, body: (await response.json()) as never };
  }
  return { env, call };
}

describe("agent settings", () => {
  const owner = "organization:write";

  it("starts empty, needs the owner scope and the current version, and validates every field", async () => {
    const { call } = setup();
    const empty = (await call("/api/agents/chef/settings")).body as { version: number; model: unknown };
    expect(empty).toMatchObject({ version: 0, model: null });
    const valid = { model: { provider: "workers-ai", model: "@cf/meta/llama-3.1-8b-instruct-fast" }, effort: "high", maxSteps: 30, dailyBudgetUsd: 5, version: 0 };
    expect((await call("/api/agents/chef/settings", { method: "PUT", body: valid })).status).toBe(403);
    expect((await call("/api/agents/nobody/settings")).status).toBe(404);
    expect((await call("/api/agents/chef/settings", { method: "PUT", body: { ...valid, effort: "max" }, scopes: owner })).status).toBe(400);
    expect((await call("/api/agents/chef/settings", { method: "PUT", body: { ...valid, maxSteps: 200 }, scopes: owner })).status).toBe(400);
    expect((await call("/api/agents/chef/settings", { method: "PUT", body: { ...valid, model: { provider: "deepseek", model: "deepseek-flash" } }, scopes: owner })).status).toBe(400);
    const saved = await call("/api/agents/chef/settings", { method: "PUT", body: valid, scopes: owner });
    expect(saved).toMatchObject({ status: 200, body: { version: 1, effort: "high", maxSteps: 30, dailyBudgetUsd: 5, updatedBy: "owner@test" } });
    expect((await call("/api/agents/chef/settings", { method: "PUT", body: valid, scopes: owner })).status).toBe(409);
  });

  it("tries the thread's choice, then the agent's model, then the role chain", async () => {
    const { env } = setup();
    const router = await ModelRouter.load(env);
    const calls: string[] = [];
    (env as unknown as { AI: unknown }).AI = {
      run: async (model: string) => {
        calls.push(model);
        throw new Error("down");
      },
    };
    await expect(
      router.chat("worker-cheap", { messages: [{ role: "user", content: "hi" }] }, {
        pinned: { provider: "workers-ai", model: "@cf/meta/llama-3.3-70b-instruct-fp8-fast" },
        preferred: { provider: "workers-ai", model: "@cf/meta/llama-3.1-8b-instruct-fast" },
      }),
    ).rejects.toThrow();
    expect(calls).toEqual(["@cf/meta/llama-3.3-70b-instruct-fp8-fast", "@cf/meta/llama-3.1-8b-instruct-fast"]);
  });
});
