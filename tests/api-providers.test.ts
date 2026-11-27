import { timingSafeEqual } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import api from "../apps/api/src/index.ts";
import type { Env } from "../apps/api/src/env.ts";
import { fromAnthropic, toAnthropic } from "../apps/api/src/models/anthropic.ts";
import { decryptSecret, encryptSecret, validateCredential } from "../apps/api/src/models/credentials.ts";
import { ModelRouter, priceOf } from "../apps/api/src/models/router.ts";
import { DEFAULT_MODEL_CONFIG, DEFAULT_PAID_PRICE } from "../apps/api/src/models/config.ts";
import { sqliteD1 } from "./_helpers/sqlite-d1.ts";

(crypto.subtle as unknown as { timingSafeEqual?: unknown }).timingSafeEqual ??= (a: ArrayBuffer, b: ArrayBuffer) => timingSafeEqual(Buffer.from(a), Buffer.from(b));

const SECRET = "0123456789abcdef0123456789abcdef0123456789abcdef";
const KEY = "sk-test-very-secret-1234";

function setup(overrides: Partial<Env> = {}) {
  const db = sqliteD1();
  const env = {
    API_SERVICE_TOKEN: "service-token",
    API_ENV: "test",
    DEFAULT_REPO: "devUgur/uguroezdamar.com",
    GITHUB_OWNERS: "devUgur",
    STORAGE: { d1: "test", d1Region: "test", kv: "test", r2: "test" },
    PROVIDER_KEYS_SECRET: SECRET,
    DB: db,
    CONFIG: { get: async () => null },
    AGENTS: { get: () => ({}) },
    OFFICE: { get: () => ({ recordEvent: async () => undefined }) },
    HUB: { get: () => ({ broadcast: async () => undefined }) },
    ...overrides,
  } as unknown as Env;

  async function call(path: string, init: { method?: string; body?: unknown; scopes?: string } = {}) {
    const response = await api.fetch(
      new Request(`https://api.test${path}`, {
        method: init.method ?? "GET",
        headers: {
          authorization: "Bearer service-token",
          "content-type": "application/json",
          "x-portal-actor": "owner@test",
          ...(init.scopes ? { "x-portal-scopes": init.scopes } : {}),
        },
        body: init.body === undefined ? undefined : JSON.stringify(init.body),
      }),
      env,
      {} as ExecutionContext,
    );
    return { status: response.status, body: (await response.json()) as never };
  }
  return { db, env, call };
}

/** Answers GET …/models like an OpenAI-compatible provider would, and records which key was sent. */
function stubModels(ids: string[]) {
  const seen: string[] = [];
  vi.stubGlobal("fetch", vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    seen.push(String(url));
    const auth = new Headers(init?.headers).get("authorization");
    if (auth !== `Bearer ${KEY}`) return new Response(JSON.stringify({ error: "bad key" }), { status: 401 });
    return new Response(JSON.stringify({ data: ids.map((id) => ({ id })) }), { status: 200, headers: { "content-type": "application/json" } });
  }));
  return seen;
}

afterEach(() => vi.unstubAllGlobals());

describe("provider keys", () => {
  it("encrypts per tenant and provider: another tenant or provider cannot decrypt the row", async () => {
    const { env } = setup();
    const sealed = await encryptSecret(env, "owner", "deepseek", KEY);
    expect(sealed.ciphertext).not.toContain("secret");
    expect(await decryptSecret(env, "owner", "deepseek", sealed)).toBe(KEY);
    await expect(decryptSecret(env, "acme", "deepseek", sealed)).rejects.toThrow();
    await expect(decryptSecret(env, "owner", "openai", sealed)).rejects.toThrow();
  });

  it("only lets the owner scope change keys, and refuses without a key store", async () => {
    expect((await setup().call("/api/providers/deepseek/key", { method: "PUT", body: { apiKey: KEY } })).status).toBe(403);
    const withoutStore = setup({ PROVIDER_KEYS_SECRET: undefined });
    expect((await withoutStore.call("/api/providers/deepseek/key", { method: "PUT", body: { apiKey: KEY }, scopes: "providers:write" })).status).toBe(503);
  });

  it("stores a key encrypted, tests it, unlocks the provider's models and never returns the key", async () => {
    const { call, db } = setup();
    const seen = stubModels(["deepseek-chat", "deepseek-v4", "text-embedding-x"]);
    const saved = await call("/api/providers/deepseek/key", { method: "PUT", body: { apiKey: KEY }, scopes: "providers:write" });
    expect(saved.status).toBe(200);
    expect(JSON.stringify(saved.body)).not.toContain(KEY);
    expect(seen[0]).toBe("https://api.deepseek.com/v1/models");
    const row = db.raw.prepare("SELECT ciphertext, key_hint, models FROM provider_credentials").get() as { ciphertext: string; key_hint: string; models: string };
    expect(row.ciphertext).not.toContain(KEY);
    expect(row.key_hint).toBe("1234");
    expect(JSON.parse(row.models)).toEqual(["deepseek-chat", "deepseek-v4"]);

    const listed = await call("/api/providers/credentials");
    expect(JSON.stringify(listed.body)).not.toContain(KEY);
    const catalog = (await call("/api/models")).body as { providers: { id: string; available: boolean; keySource: string; models: { id: string }[] }[] };
    const deepseek = catalog.providers.find((provider) => provider.id === "deepseek");
    expect(deepseek).toMatchObject({ available: true, keySource: "tenant" });
    expect(deepseek?.models.map((model) => model.id)).toEqual(["deepseek-flash", "deepseek-v4-pro", "deepseek-chat", "deepseek-reasoner", "deepseek-v4"]);
  });

  it("puts the tenant's chosen model first for a role and checks the choice exists", async () => {
    const { call, env } = setup();
    stubModels(["deepseek-chat"]);
    await call("/api/providers/deepseek/key", { method: "PUT", body: { apiKey: KEY }, scopes: "providers:write" });
    expect((await call("/api/models/defaults/chef-smart", { method: "PUT", body: { provider: "deepseek", model: "nope" }, scopes: "providers:write" })).status).toBe(400);
    expect((await call("/api/models/defaults/chef-smart", { method: "PUT", body: { provider: "deepseek", model: "deepseek-chat" }, scopes: "providers:write" })).status).toBe(200);
    const router = await ModelRouter.load(env);
    expect(router.chain("chef-smart")[0]).toMatchObject({ provider: "deepseek", model: "deepseek-chat", available: true });
    expect((await call("/api/providers/deepseek/key", { method: "DELETE", scopes: "providers:write" })).status).toBe(200);
    expect((await ModelRouter.load(env)).chain("chef-smart")[0]?.provider).toBe("anthropic");
  });

  it("adds a custom OpenAI-compatible provider and rejects unsafe base URLs", async () => {
    expect(() => validateCredential("custom-x", { apiKey: KEY, label: "X", baseUrl: "http://example.com/v1" })).toThrow(/https/);
    expect(() => validateCredential("custom-x", { apiKey: KEY, label: "X", baseUrl: "https://127.0.0.1/v1" })).toThrow();
    expect(() => validateCredential("workers-ai", { apiKey: KEY })).toThrow();
    const { call } = setup();
    stubModels(["qwen3-coder"]);
    const saved = await call("/api/providers/custom-my-vllm/key", { method: "PUT", body: { apiKey: KEY, label: "Mein vLLM", baseUrl: "https://llm.example.com/v1", trainsOnData: false }, scopes: "providers:write" });
    expect(saved.status).toBe(200);
    const catalog = (await call("/api/models")).body as { providers: { id: string; custom: boolean; trainsOnData: boolean; models: { id: string }[] }[] };
    expect(catalog.providers.find((provider) => provider.id === "custom-my-vllm")).toMatchObject({ custom: true, trainsOnData: false, models: [{ id: "qwen3-coder" }] });
  });

  it("uses the owner's Worker secrets only for the owner, never for another tenant", async () => {
    const { env } = setup({ ANTHROPIC_API_KEY: "sk-ant-owner" } as Partial<Env>);
    const owner = (await ModelRouter.load(env, "owner")).catalog().providers.find((provider) => provider.id === "anthropic");
    const other = (await ModelRouter.load(env, "acme")).catalog().providers.find((provider) => provider.id === "anthropic");
    expect(owner).toMatchObject({ available: true, keySource: "environment" });
    expect(other).toMatchObject({ available: false, keySource: "none" });
  });

  it("counts unknown prices of paid models with the high default, free ones with zero", () => {
    expect(priceOf(DEFAULT_MODEL_CONFIG.providers.moonshot, { id: "x", label: "x" })).toEqual(DEFAULT_PAID_PRICE);
    expect(priceOf(DEFAULT_MODEL_CONFIG.providers.deepseek, { id: "x", label: "x" })).toEqual({ inputUsdPerM: 1.32, outputUsdPerM: 3.96 });
    expect(priceOf(DEFAULT_MODEL_CONFIG.providers["workers-ai"], { id: "x", label: "x" })).toEqual({ inputUsdPerM: 0, outputUsdPerM: 0 });
  });
});

describe("Anthropic wire format", () => {
  it("moves the system prompt up, groups tool results, replays Claude's own turns and drops orphan results", () => {
    const raw = [{ type: "thinking", thinking: "", signature: "sig" }, { type: "tool_use", id: "toolu_1", name: "repo_read_file", input: { path: "AGENTS.md" } }];
    const { system, messages } = toAnthropic([
      { role: "system", content: "Du bist der Chef-Agent." },
      { role: "tool", content: "verwaist", toolCallId: "gone" },
      { role: "user", content: "Lies AGENTS.md" },
      { role: "assistant", content: null, toolCalls: [{ id: "toolu_1", name: "repo_read_file", arguments: "{}" }], raw: { provider: "anthropic", content: raw } },
      { role: "tool", content: "# Regeln", toolCallId: "toolu_1" },
      { role: "assistant", content: "Fertig.", toolCalls: [{ id: "call_9", name: "repo_list_files", arguments: '{"path":"apps"}' }] },
      { role: "tool", content: "[]", toolCallId: "call_9" },
    ]);
    expect(system).toBe("Du bist der Chef-Agent.");
    expect(messages.map((message) => message.role)).toEqual(["user", "assistant", "user", "assistant", "user"]);
    expect(messages[1]?.content).toEqual(raw);
    expect(messages[2]?.content).toEqual([{ type: "tool_result", tool_use_id: "toolu_1", content: "# Regeln" }]);
    expect(messages[3]?.content).toEqual([
      { type: "text", text: "Fertig." },
      { type: "tool_use", id: "call_9", name: "repo_list_files", input: { path: "apps" } },
    ]);
  });

  it("reads text, tool calls and usage, and never runs a tool cut off at the token limit", () => {
    const base = { id: "m", type: "message", role: "assistant", model: "claude-sonnet-5-5", stop_sequence: null, usage: { input_tokens: 10, output_tokens: 5, cache_read_input_tokens: 90, cache_creation_input_tokens: 0 } };
    const ok = fromAnthropic({ ...base, stop_reason: "tool_use", content: [{ type: "text", text: "Ich lese." }, { type: "tool_use", id: "toolu_2", name: "repo_read_file", input: { path: "x" } }] } as never);
    expect(ok.message).toMatchObject({ content: "Ich lese.", toolCalls: [{ id: "toolu_2", name: "repo_read_file", arguments: '{"path":"x"}' }], raw: { provider: "anthropic" } });
    expect(ok.usage).toEqual({ inputTokens: 100, outputTokens: 5, cacheReadTokens: 90, cacheWriteTokens: 0 });
    const cut = fromAnthropic({ ...base, stop_reason: "max_tokens", content: [{ type: "tool_use", id: "toolu_3", name: "repo_commit_files", input: {} }] } as never);
    expect(cut.message.toolCalls).toBeUndefined();
    expect(cut.message.raw).toBeUndefined();
  });
});

describe("sprints", () => {
  it("plans tasks into a sprint, allows one active sprint per project and returns open work when it ends", async () => {
    const { call, db } = setup();
    const sprint = (await call("/api/projects/uguroezdamar/sprints", { method: "POST", body: { name: "Sprint 1", goal: "Chat stabil", startsAt: "2026-11-26", endsAt: "2026-12-10" } })).body as { id: string };
    const second = (await call("/api/projects/uguroezdamar/sprints", { method: "POST", body: { name: "Sprint 2" } })).body as { id: string };
    const open = (await call("/api/tasks", { method: "POST", body: { title: "Offen", sprintId: sprint.id } })).body as { id: string; sprintId: string };
    expect(open.sprintId).toBe(sprint.id);
    expect((await call("/api/sprints/" + sprint.id, { method: "PATCH", body: { status: "active" } })).status).toBe(200);
    expect((await call("/api/sprints/" + second.id, { method: "PATCH", body: { status: "active" } })).status).toBe(409);
    const listed = (await call("/api/projects/uguroezdamar/sprints")).body as { id: string; tasksTotal: number; status: string }[];
    expect(listed[0]).toMatchObject({ id: sprint.id, status: "active", tasksTotal: 1 });
    expect((await call("/api/sprints/" + sprint.id, { method: "PATCH", body: { status: "done" } })).status).toBe(200);
    expect(db.raw.prepare("SELECT sprint_id FROM tasks WHERE id = ?").get(open.id)).toEqual({ sprint_id: null });
    expect((await call(`/api/tasks/${open.id}`, { method: "PATCH", body: { sprintId: sprint.id } })).status).toBe(400);
  });
});

describe("Anthropic adapter over the SDK", () => {
  it("streams text, returns tool calls and sends effort, caching and the refusal fallback", async () => {
    const { AnthropicModel } = await import("../apps/api/src/models/anthropic.ts");
    const events = [
      { type: "message_start", message: { id: "msg_1", type: "message", role: "assistant", model: "claude-sonnet-5-5", content: [], stop_reason: null, stop_sequence: null, usage: { input_tokens: 12, output_tokens: 0 } } },
      { type: "content_block_start", index: 0, content_block: { type: "text", text: "" } },
      { type: "content_block_delta", index: 0, delta: { type: "text_delta", text: "Hallo " } },
      { type: "content_block_delta", index: 0, delta: { type: "text_delta", text: "Ugur" } },
      { type: "content_block_stop", index: 0 },
      { type: "content_block_start", index: 1, content_block: { type: "tool_use", id: "toolu_9", name: "repo_read_file", input: {} } },
      { type: "content_block_delta", index: 1, delta: { type: "input_json_delta", partial_json: '{"path":"AGENTS.md"}' } },
      { type: "content_block_stop", index: 1 },
      { type: "message_delta", delta: { stop_reason: "tool_use", stop_sequence: null }, usage: { output_tokens: 7 } },
      { type: "message_stop" },
    ];
    const sse = events.map((event) => `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`).join("");
    let sent: Record<string, unknown> = {};
    let url = "";
    vi.stubGlobal("fetch", vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      url = String(input instanceof Request ? input.url : input);
      sent = JSON.parse(String(init?.body ?? (input instanceof Request ? await input.text() : "{}")));
      return new Response(sse, { status: 200, headers: { "content-type": "text/event-stream" } });
    }));
    const deltas: string[] = [];
    const result = await new AnthropicModel("sk-ant-test").chat(
      { model: "claude-sonnet-5-5", messages: [{ role: "system", content: "S" }, { role: "user", content: "Hi" }], tools: [{ name: "repo_read_file", description: "liest", parameters: { type: "object", properties: {} } }] },
      (text) => deltas.push(text),
    );
    expect(url).toContain("/v1/messages");
    expect(sent).toMatchObject({ model: "claude-sonnet-5-5", system: "S", output_config: { effort: "medium" }, cache_control: { type: "ephemeral" }, fallbacks: "default", stream: true });
    expect(deltas.join("")).toBe("Hallo Ugur");
    expect(result.message).toMatchObject({ content: "Hallo Ugur", toolCalls: [{ id: "toolu_9", name: "repo_read_file", arguments: '{"path":"AGENTS.md"}' }] });
    expect(result.usage).toEqual({ inputTokens: 12, outputTokens: 7, cacheReadTokens: 0, cacheWriteTokens: 0 });
  });
});

describe("private repositories and evaluating providers", () => {
  function withThreads() {
    const status = { running: false, step: 0, private: false };
    const context = setup({
      AGENTS: { get: () => ({ status: async () => status, history: async () => [] }) },
    } as unknown as Partial<Env>);
    context.db.raw.prepare("INSERT INTO projects (id, name, repo, visibility, status) VALUES ('video-studio', 'video-studio', 'devUgur/video-studio', 'private', 'active')").run();
    return { ...context, status };
  }

  it("names a provider it left out for private content instead of skipping it silently", async () => {
    stubModels(["deepseek-chat"]);
    const { call, env: keyed } = setup();
    await call("/api/providers/deepseek/key", { method: "PUT", body: { apiKey: KEY }, scopes: "providers:write" });
    const router = await ModelRouter.load(keyed);
    await expect(router.chat("worker-cheap", { messages: [] }, { privateContent: true, pinned: { provider: "deepseek", model: "deepseek-chat" } })).rejects.toThrow(
      /deepseek\/deepseek-chat: gesperrt \(strenge Datenrichtlinie/,
    );
  });

  it("refuses an evaluating model for a private project and drops it when the chat moves into one", async () => {
    const { call } = withThreads();
    stubModels(["deepseek-chat"]);
    await call("/api/providers/deepseek/key", { method: "PUT", body: { apiKey: KEY }, scopes: "providers:write" });
    const thread = (await call("/api/threads", { method: "POST", body: { projectId: "video-studio" } })).body as { id: string };
    const refused = await call(`/api/threads/${thread.id}`, { method: "PATCH", body: { model: { provider: "deepseek", model: "deepseek-chat" } } });
    expect(refused.status).toBe(400);
    expect((refused.body as { error: string }).error).toMatch(/DeepSeek.*gesperrt/);

    const open = (await call("/api/threads", { method: "POST", body: { projectId: "uguroezdamar" } })).body as { id: string };
    expect((await call(`/api/threads/${open.id}`, { method: "PATCH", body: { model: { provider: "deepseek", model: "deepseek-chat" } } })).status).toBe(200);
    const moved = await call(`/api/threads/${open.id}`, { method: "PATCH", body: { projectId: "video-studio" } });
    expect(moved.body).toMatchObject({ projectId: "video-studio", model: null });
    expect((moved.body as { notice: string }).notice).toMatch(/gesperrt/);
  });
});

describe("data policy per project", () => {
  it("follows the repository by default and lets only the owner open a private project for evaluating providers", async () => {
    const status = { running: false, step: 0, private: false };
    const { call, db } = setup({ AGENTS: { get: () => ({ status: async () => status, history: async () => [] }) } } as unknown as Partial<Env>);
    db.raw.prepare("INSERT INTO projects (id, name, repo, visibility, status) VALUES ('video-studio', 'video-studio', 'devUgur/video-studio', 'private', 'active')").run();
    stubModels(["deepseek-chat"]);
    await call("/api/providers/deepseek/key", { method: "PUT", body: { apiKey: KEY }, scopes: "providers:write" });

    const before = (await call("/api/projects")).body as { id: string; modelPolicy: string; modelPolicyExplicit: boolean }[];
    expect(before.find((project) => project.id === "video-studio")).toMatchObject({ modelPolicy: "strict", modelPolicyExplicit: false });
    expect((await call("/api/projects/video-studio", { method: "PATCH", body: { modelPolicy: "open" } })).status).toBe(403);
    expect((await call("/api/projects/video-studio", { method: "PATCH", body: { modelPolicy: "loose" }, scopes: "providers:write" })).status).toBe(400);
    expect((await call("/api/projects/video-studio", { method: "PATCH", body: { modelPolicy: "open" }, scopes: "providers:write" })).status).toBe(200);

    const thread = (await call("/api/threads", { method: "POST", body: { projectId: "video-studio" } })).body as { id: string };
    expect((await call(`/api/threads/${thread.id}`, { method: "PATCH", body: { model: { provider: "deepseek", model: "deepseek-chat" } } })).status).toBe(200);
    const detail = (await call(`/api/threads/${thread.id}`)).body as { projects: { id: string; modelPolicy: string }[] };
    expect(detail.projects.find((project) => project.id === "video-studio")?.modelPolicy).toBe("open");

    expect((await call("/api/projects/video-studio", { method: "PATCH", body: { modelPolicy: null }, scopes: "providers:write" })).status).toBe(200);
    expect((await call(`/api/threads/${thread.id}`, { method: "PATCH", body: { model: { provider: "deepseek", model: "deepseek-chat" } } })).status).toBe(400);
  });

  it("keeps a thread strict for unregistered or strict private repositories, not for opened ones", async () => {
    const { anyStrict } = await import("../apps/api/src/projects/policy.ts");
    const { env, db } = setup();
    db.raw.prepare("INSERT INTO projects (id, name, repo, visibility, status, model_policy) VALUES ('open-one', 'open-one', 'devUgur/Open-One', 'private', 'active', 'open')").run();
    db.raw.prepare("INSERT INTO projects (id, name, repo, visibility, status) VALUES ('closed', 'closed', 'devUgur/closed', 'private', 'active')").run();
    expect(await anyStrict(env, "owner", ["devugur/open-one"])).toBe(false);
    expect(await anyStrict(env, "owner", ["devUgur/open-one", "devUgur/closed"])).toBe(true);
    expect(await anyStrict(env, "owner", ["someone/unknown"])).toBe(true);
    expect(await anyStrict(env, "acme", ["devUgur/open-one"])).toBe(true);
  });
});
