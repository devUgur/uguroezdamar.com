import { timingSafeEqual } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import api from "../apps/api/src/index.ts";
import type { Env } from "../apps/api/src/env.ts";
import { sqliteD1 } from "./_helpers/sqlite-d1.ts";

// Workers add timingSafeEqual to crypto.subtle; Node has it on the crypto module only.
(crypto.subtle as unknown as { timingSafeEqual?: unknown }).timingSafeEqual ??= (a: ArrayBuffer, b: ArrayBuffer) => timingSafeEqual(Buffer.from(a), Buffer.from(b));

/**
 * The API's real routes on real SQLite with every migration applied (tests/_helpers/sqlite-d1.ts):
 * the SQL is executed, not mocked, so a wrong column list, a placeholder mismatch or a missing tenant
 * filter fails here instead of in production.
 */
function setup() {
  const db = sqliteD1();
  const objects: string[] = [];
  const chat = vi.fn(async () => ({ accepted: true }));
  const agentStub = {
    history: async () => [],
    status: async () => ({ running: false, step: 0 }),
    chat,
    stop: async () => undefined,
    resume: async () => ({ accepted: true }),
  };
  const kv = new Map<string, string>();
  const env = {
    API_SERVICE_TOKEN: "service-token",
    API_ENV: "test",
    DEFAULT_REPO: "devUgur/uguroezdamar.com",
    GITHUB_OWNERS: "devUgur",
    STORAGE: { d1: "test", d1Region: "test", kv: "test", r2: "test" },
    DB: db,
    CONFIG: { get: async (key: string) => kv.get(key) ?? null, put: async (key: string, value: string) => void kv.set(key, value) },
    AGENTS: { idFromName: (name: string) => (objects.push(name), name), get: () => agentStub },
    OFFICE: { idFromName: (name: string) => name, get: () => ({ recordEvent: async () => undefined, configure: async (layout: unknown) => layout }) },
    HUB: { idFromName: (name: string) => name, get: () => ({ broadcast: async () => undefined }) },
  } as unknown as Env;

  async function call(path: string, init: { method?: string; body?: unknown } = {}) {
    const response = await api.fetch(
      new Request(`https://api.test${path}`, {
        method: init.method ?? "GET",
        headers: { authorization: "Bearer service-token", "content-type": "application/json", "x-portal-actor": "test" },
        body: init.body === undefined ? undefined : JSON.stringify(init.body),
      }),
      env,
      {} as ExecutionContext,
    );
    return { status: response.status, body: (await response.json()) as never };
  }
  return { db, call, objects, chat };
}

const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

describe("routes on real SQLite", () => {
  it("creates and lists a task for the owner with its tenant", async () => {
    const { call, db } = setup();
    const created = await call("/api/tasks", { method: "POST", body: { title: "Systemtest", description: "Beschreibung" } });
    expect(created.status).toBe(201);
    const listed = await call("/api/tasks");
    expect((listed.body as { title: string }[]).map((task) => task.title)).toEqual(["Systemtest"]);
    expect(db.raw.prepare("SELECT tenant_id FROM tasks").get()).toEqual({ tenant_id: "owner" });
  });

  it("creates a thread, reads it with its projects, switches project and sends a chat under the owner's object name", async () => {
    const { call, objects, chat } = setup();
    const created = await call("/api/threads", { method: "POST", body: {} });
    expect(created.status).toBe(201);
    const id = (created.body as { id: string }).id;

    const detail = await call(`/api/threads/${id}`);
    expect(detail.status).toBe(200);
    expect((detail.body as { projects: { id: string }[] }).projects.map((project) => project.id)).toEqual(["uguroezdamar"]);

    expect((await call(`/api/threads/${id}`, { method: "PATCH", body: { projectId: "uguroezdamar" } })).status).toBe(200);
    expect((await call(`/api/threads/${id}/chat`, { method: "POST", body: { text: "Hallo" } })).status).toBe(200);
    expect(chat).toHaveBeenCalledWith(expect.objectContaining({ tenantId: "owner", threadId: id }));
    expect(objects).toContain(`thread:${id}`);
  });

  it("answers the list routes the portal uses", async () => {
    const { call } = setup();
    for (const path of ["/api/projects", "/api/threads", "/api/tasks", "/api/agents", "/api/approvals", "/api/events", "/api/office/state", "/api/agents/chef/config"]) {
      expect((await call(path)).status, path).toBe(200);
    }
  });
});

describe("one tenant cannot reach another's rows through the routes", () => {
  function withForeignRows() {
    const harness = setup();
    const { db } = harness;
    db.raw.exec(`
      INSERT INTO tenants (id, name) VALUES ('acme', 'Acme');
      INSERT INTO projects (id, tenant_id, name, repo, status) VALUES ('acme-site', 'acme', 'Acme Site', 'acme/site', 'active');
      INSERT INTO threads (id, tenant_id, agent_id, project_id, title) VALUES ('${uuid(1)}', 'acme', 'chef', 'acme-site', 'Geheim');
      INSERT INTO tasks (id, tenant_id, project_id, title, status) VALUES ('${uuid(2)}', 'acme', 'acme-site', 'Fremde Aufgabe', 'ready');
      INSERT INTO approvals (id, tenant_id, agent_id, thread_id, action, details) VALUES ('${uuid(3)}', 'acme', 'chef', '${uuid(1)}', 'repo_commit_files', '{"args":{},"projectId":"acme-site","repo":"acme/site"}');
      INSERT INTO events (tenant_id, agent_id, thread_id, project_id, type, data) VALUES ('acme', 'chef', '${uuid(1)}', 'acme-site', 'message', '{"text":"fremd"}');
    `);
    return harness;
  }

  it("keeps the lists apart", async () => {
    const { call } = withForeignRows();
    expect(JSON.stringify((await call("/api/projects")).body)).not.toContain("acme-site");
    expect(JSON.stringify((await call("/api/threads")).body)).not.toContain("Geheim");
    expect(JSON.stringify((await call("/api/tasks")).body)).not.toContain("Fremde");
    expect(JSON.stringify((await call("/api/approvals")).body)).not.toContain(uuid(3));
    expect(JSON.stringify((await call("/api/events?limit=50")).body)).not.toContain("fremd");
  });

  it("answers 404 for another tenant's thread, task and approval", async () => {
    const { call, db } = withForeignRows();
    expect((await call(`/api/threads/${uuid(1)}`)).status).toBe(404);
    expect((await call(`/api/threads/${uuid(1)}/chat`, { method: "POST", body: { text: "x" } })).status).toBe(404);
    expect((await call(`/api/tasks/${uuid(2)}`, { method: "PATCH", body: { title: "übernommen" } })).status).toBe(404);
    expect((await call(`/api/tasks/${uuid(2)}/run`, { method: "POST" })).status).toBe(404);
    expect((await call(`/api/approvals/${uuid(3)}`, { method: "POST", body: { decision: "approve" } })).status).toBe(404);
    expect(db.raw.prepare("SELECT status FROM approvals WHERE id = ?").get(uuid(3))).toEqual({ status: "pending" });
    expect(db.raw.prepare("SELECT title FROM tasks WHERE id = ?").get(uuid(2))).toEqual({ title: "Fremde Aufgabe" });
  });

  it("refuses a thread in another tenant's project", async () => {
    const { call } = withForeignRows();
    expect((await call("/api/threads", { method: "POST", body: { projectId: "acme-site" } })).status).toBe(400);
    expect((await call("/api/tasks", { method: "POST", body: { title: "x", projectId: "acme-site" } })).status).toBe(400);
  });
});
