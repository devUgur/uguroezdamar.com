import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import api from "../apps/api/src/index.ts";
import { actorHost } from "../apps/api/src/node/actors.ts";
import { nodePlatform, type NodePlatform } from "../apps/api/src/node/platform.ts";

/**
 * ADR 0045, R1: the agent API on Node runs a whole chat without Cloudflare. Every outgoing request is recorded;
 * only the model provider may be called.
 */
const TOKEN = "node-host-token";
let platform: NodePlatform | undefined;
const dirs: string[] = [];

afterEach(() => {
  platform?.close();
  platform = undefined;
  vi.unstubAllGlobals();
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

function call(path: string, init: { method?: string; body?: unknown } = {}) {
  return api
    .fetch(
      new Request(`http://localhost:3103${path}`, {
        method: init.method ?? "GET",
        headers: { authorization: `Bearer ${TOKEN}`, "x-portal-actor": "test", "content-type": "application/json" },
        body: init.body === undefined ? undefined : JSON.stringify(init.body),
      }),
      platform!.env,
    )
    .then(async (response) => ({ status: response.status, body: (await response.json()) as Record<string, unknown> }));
}

describe("node host without Cloudflare", () => {
  it("runs an agent chat end to end and calls nothing but the model", async () => {
    const outgoing: string[] = [];
    vi.stubGlobal("fetch", async (input: string | URL | Request) => {
      const url = input instanceof Request ? input.url : String(input);
      outgoing.push(url);
      if (url.startsWith("https://api.deepseek.com/")) {
        return Response.json({ choices: [{ message: { role: "assistant", content: "Hallo, ich bin lokal." } }], usage: { prompt_tokens: 10, completion_tokens: 5 } });
      }
      return new Response("not allowed in this test", { status: 599 });
    });
    platform = nodePlatform({ dataDir: null, vars: { API_SERVICE_TOKEN: TOKEN, DEEPSEEK_API_KEY: "test-key" } });

    const created = await call("/api/threads", { method: "POST", body: { agentId: "chef", projectId: null, title: "Lokal", model: { provider: "deepseek", model: "deepseek-flash" } } });
    expect(created.status).toBe(201);
    const threadId = String(created.body.id);
    expect((await call(`/api/threads/${threadId}/chat`, { method: "POST", body: { text: "Hallo" } })).body).toMatchObject({ accepted: true });

    let messages: { role: string; content: string | null }[] = [];
    for (let attempt = 0; attempt < 100; attempt += 1) {
      const view = await call(`/api/threads/${threadId}`);
      messages = (view.body.messages as typeof messages) ?? [];
      if (messages.some((message) => message.role === "assistant") && !(view.body.status as { running?: boolean })?.running) break;
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    expect(messages.map((message) => [message.role, message.content])).toContainEqual(["assistant", "Hallo, ich bin lokal."]);
    expect(outgoing.length).toBeGreaterThan(0);
    expect(outgoing.every((url) => url.startsWith("https://api.deepseek.com/"))).toBe(true);
  });

  it("issues one-time live tickets and records who listens", async () => {
    platform = nodePlatform({ dataDir: null, vars: { API_SERVICE_TOKEN: TOKEN } });
    const { ticket } = (await call("/api/live-ticket", { method: "POST" })).body as { ticket: string };
    expect(platform.hub.redeem(ticket)).toBe(true);
    expect(platform.hub.redeem(ticket)).toBe(false);
    const sent: string[] = [];
    const socket = { send: (text: string) => void sent.push(text), close: () => undefined };
    await platform.hub.connect(socket);
    await platform.hub.message(socket, "subscribe:office");
    await platform.hub.message(socket, "ping");
    expect(sent).toContain("pong");
    expect(await platform.env.DB.prepare("SELECT sockets, office FROM live_presence WHERE hub = 'main'").first()).toEqual({ sockets: 1, office: 1 });
    await platform.hub.disconnect(socket);
    expect(await platform.env.DB.prepare("SELECT sockets, office FROM live_presence WHERE hub = 'main'").first()).toEqual({ sockets: 0, office: 0 });
  });

  it("keeps an actor's state and wake-up time across a restart", async () => {
    const dir = mkdtempSync(join(tmpdir(), "node-host-"));
    dirs.push(dir);
    const woke: string[] = [];
    const make = () =>
      actorHost(dir, (state, name) => ({
        state,
        alarm: async () => void woke.push(name),
      }));
    const first = make();
    await first.get("thread:a").state.put("run", { steps: 2 });
    await first.get("thread:a").state.setAlarm(Date.now() + 60_000);
    first.close();

    const second = make();
    expect(second.rearm()).toBe(1);
    expect(await second.get("thread:a").state.get("run")).toEqual({ steps: 2 });
    await second.get("thread:a").state.setAlarm(Date.now());
    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(woke).toEqual(["thread:a"]);
    second.close();
  });
});
