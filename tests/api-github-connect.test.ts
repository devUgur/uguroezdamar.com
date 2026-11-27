import { afterEach, describe, expect, it, vi } from "vitest";
import { completeConnect, readState, safeReturnUrl, signState, startConnect } from "../apps/api/src/github/connect.ts";
import { allowedOwnersFor } from "../apps/api/src/github/tenants.ts";
import { APP_PRIVATE_KEY, apiHarness, sign, stubGithubApp, WEBHOOK_SECRET } from "./_helpers/api-env.ts";

const app = { AGENT_GH_APP_ID: "123", AGENT_GH_APP_PRIVATE_KEY: APP_PRIVATE_KEY, AGENT_GH_WEBHOOK_SECRET: WEBHOOK_SECRET };
const RETURN = "https://portal.example/projects";
const stateOf = (url: string) => new URL(url).searchParams.get("state") ?? "";

afterEach(() => vi.unstubAllGlobals());

describe("the signed state of the connect flow", () => {
  const payload = (over: Record<string, unknown> = {}) => ({ t: "acme", r: RETURN, n: "nonce-1", e: Math.floor(Date.now() / 1000) + 600, ...over });

  it("survives the round trip and carries the tenant", async () => {
    const { env } = apiHarness();
    expect(await readState(env, await signState(env, payload()))).toMatchObject({ t: "acme", r: RETURN });
  });

  it("rejects a changed body, a changed signature, an expired state and a state signed with another key", async () => {
    const { env } = apiHarness();
    const state = await signState(env, payload());
    const [body, signature] = state.split(".") as [string, string];
    const forged = Buffer.from(JSON.stringify(payload({ t: "owner" }))).toString("base64url");
    expect(await readState(env, `${forged}.${signature}`)).toBeNull();
    expect(await readState(env, `${body}.${signature.slice(0, -2)}AA`)).toBeNull();
    expect(await readState(env, await signState(env, payload({ e: 1 })))).toBeNull();
    const { env: other } = apiHarness({ API_SERVICE_TOKEN: "another-token" });
    expect(await readState(other, state)).toBeNull();
    expect(await readState(env, "garbage")).toBeNull();
  });

  it("only allows returning to https pages or a local server, without credentials", () => {
    expect(safeReturnUrl("https://portal.example/projects")).toBe("https://portal.example/projects");
    expect(safeReturnUrl("http://localhost:3101/projects")).toBe("http://localhost:3101/projects");
    for (const bad of ["http://portal.example/", "https://user:pw@portal.example/", "javascript:alert(1)", "//evil.example", "nonsense"]) {
      expect(safeReturnUrl(bad), bad).toBeNull();
    }
  });
});

describe("connecting a GitHub account", () => {
  it("builds the installation link from the app's own name and a state for the tenant", async () => {
    stubGithubApp();
    const { env } = apiHarness(app);
    const url = await startConnect(env, "acme", RETURN);
    expect(url).toMatch(/^https:\/\/github\.com\/apps\/my-agents\/installations\/new\?state=/);
    expect(await readState(env, stateOf(url))).toMatchObject({ t: "acme", r: RETURN });
  });

  it("refuses without an app and for a bad return address", async () => {
    const { env } = apiHarness();
    await expect(startConnect(env, "acme", RETURN)).rejects.toMatchObject({ status: 503 });
    stubGithubApp();
    const { env: withApp } = apiHarness(app);
    await expect(startConnect(withApp, "acme", "http://evil.example")).rejects.toMatchObject({ status: 400 });
  });

  it("records the installation for the tenant that started the flow and lets it use that account", async () => {
    stubGithubApp();
    const { env, db, kv } = apiHarness(app);
    await db.exec("INSERT INTO tenants (id, name) VALUES ('acme', 'Acme')");
    kv.set("github:installations", "[]");
    const result = await completeConnect(env, 42, stateOf(await startConnect(env, "acme", RETURN)));
    expect(result).toMatchObject({ returnTo: RETURN, notice: expect.stringContaining("acme-corp") });
    expect((await db.one("SELECT tenant_id, account, selection, status FROM tenant_installations WHERE installation_id = 42"))).toEqual({
      tenant_id: "acme",
      account: "acme-corp",
      selection: "selected",
      status: "active",
    });
    expect(kv.has("github:installations")).toBe(false);
    expect(await allowedOwnersFor(env, "acme")).toEqual(["acme-corp"]);
    expect(await allowedOwnersFor(env, "owner")).toEqual(["devugur"]);
  });

  it("works once only: the same link a second time is refused", async () => {
    stubGithubApp();
    const { env, db } = apiHarness(app);
    await db.exec("INSERT INTO tenants (id, name) VALUES ('acme', 'Acme')");
    const state = stateOf(await startConnect(env, "acme", RETURN));
    expect((await completeConnect(env, 42, state)).notice).toBeTruthy();
    expect((await completeConnect(env, 42, state)).error).toMatch(/schon benutzt/);
  });

  it("does not attach an installation another tenant already owns", async () => {
    stubGithubApp();
    const { env, db } = apiHarness(app);
    await db.exec("INSERT INTO tenants (id, name) VALUES ('acme', 'Acme'), ('globex', 'Globex')");
    expect((await completeConnect(env, 42, stateOf(await startConnect(env, "acme", RETURN)))).notice).toBeTruthy();
    const stolen = await completeConnect(env, 42, stateOf(await startConnect(env, "globex", RETURN)));
    expect(stolen.error).toMatch(/anderen Konto/);
    expect((await db.one("SELECT tenant_id FROM tenant_installations WHERE installation_id = 42"))).toEqual({ tenant_id: "acme" });
  });

  it("asks GitHub about the installation instead of believing the id in the link", async () => {
    stubGithubApp({ installation: null });
    const { env, db } = apiHarness(app);
    await db.exec("INSERT INTO tenants (id, name) VALUES ('acme', 'Acme')");
    const result = await completeConnect(env, 999, stateOf(await startConnect(env, "acme", RETURN)));
    expect(result.error).toMatch(/kennt diese Installation nicht/);
    expect((await db.one("SELECT COUNT(*) AS n FROM tenant_installations"))).toEqual({ n: 0 });
  });

  it("refuses an invalid state without a place to return to", async () => {
    const { env } = apiHarness(app);
    expect(await completeConnect(env, 42, "nope")).toMatchObject({ returnTo: "", error: expect.stringContaining("abgelaufen") });
  });
});

describe("the connect routes", () => {
  it("answers the portal's request with the link, and the Setup URL with a redirect back to the portal", async () => {
    stubGithubApp();
    const { request, db } = apiHarness(app);
    await db.exec("INSERT INTO tenants (id, name) VALUES ('owner2', 'x')");
    const started = await request("/api/github/connect", { method: "POST", body: { returnTo: RETURN } });
    expect(started.status).toBe(200);
    const state = stateOf((started.body as { url: string }).url);

    const back = await request(`/api/github/setup?installation_id=42&setup_action=install&state=${encodeURIComponent(state)}`, { auth: false });
    expect(back.status).toBe(302);
    expect(new URL(back.location ?? "").searchParams.get("notice")).toContain("acme-corp");
    expect(back.location?.startsWith(RETURN)).toBe(true);
  });

  it("needs the service token for the connect request but not for GitHub's redirect", async () => {
    const { request } = apiHarness(app);
    expect((await request("/api/github/connect", { method: "POST", body: { returnTo: RETURN }, auth: false })).status).toBe(401);
    expect((await request("/api/github/setup?installation_id=1&state=bad", { auth: false })).status).toBe(400);
  });
});

describe("the webhook receiver", () => {
  const delivery = (body: object, headers: Record<string, string> = {}, secret = WEBHOOK_SECRET) => {
    const raw = JSON.stringify(body);
    return { raw, auth: false as const, method: "POST", headers: { "x-hub-signature-256": sign(raw, secret), "x-github-event": "installation", "x-github-delivery": crypto.randomUUID(), ...headers } };
  };

  it("refuses everything without a configured secret, a signature or with a wrong one", async () => {
    const { request } = apiHarness(app);
    const { request: noSecret } = apiHarness({});
    expect((await noSecret("/webhooks/github", delivery({}))).status).toBe(503);
    expect((await request("/webhooks/github", { ...delivery({}), headers: { "x-github-event": "ping" } })).status).toBe(401);
    expect((await request("/webhooks/github", delivery({}, {}, "someone-elses-secret"))).status).toBe(401);
    expect((await request("/webhooks/github", { method: "GET", auth: false })).status).toBe(405);
  });

  it("answers a ping and ignores events nobody consumes yet", async () => {
    const { request } = apiHarness(app);
    expect((await request("/webhooks/github", delivery({ zen: "x" }, { "x-github-event": "ping" }))).status).toBe(200);
    expect((await request("/webhooks/github", delivery({ ref: "main" }, { "x-github-event": "push" }))).body).toMatchObject({ ignored: "push" });
  });

  it("marks an installation deleted or suspended and drops the cached access at once", async () => {
    const { request, db, kv } = apiHarness(app);
    await db.exec("INSERT INTO tenants (id, name) VALUES ('acme', 'Acme'); INSERT INTO tenant_installations (installation_id, tenant_id, account, selection) VALUES (42, 'acme', 'acme-corp', 'all')");
    kv.set("github:installations", "[]");
    kv.set("github:token:42", "ghs_old");
    const status = () => db.one("SELECT status FROM tenant_installations WHERE installation_id = 42");

    expect((await request("/webhooks/github", delivery({ action: "suspend", installation: { id: 42 } }))).status).toBe(202);
    expect(await status()).toEqual({ status: "suspended" });
    expect(kv.has("github:token:42")).toBe(false);
    expect(await allowedOwnersFor(apiHarness().env, "acme")).toEqual([]);

    await request("/webhooks/github", delivery({ action: "unsuspend", installation: { id: 42 } }));
    expect(await status()).toEqual({ status: "active" });
    await request("/webhooks/github", delivery({ action: "deleted", installation: { id: 42 } }));
    expect(await status()).toEqual({ status: "deleted" });
  });

  it("follows a change of the selected repositories", async () => {
    const { request, db } = apiHarness(app);
    await db.exec("INSERT INTO tenants (id, name) VALUES ('acme', 'Acme'); INSERT INTO tenant_installations (installation_id, tenant_id, account, selection) VALUES (42, 'acme', 'acme-corp', 'selected')");
    await request("/webhooks/github", delivery({ action: "added", installation: { id: 42, repository_selection: "all" } }, { "x-github-event": "installation_repositories" }));
    expect((await db.one("SELECT selection, status FROM tenant_installations WHERE installation_id = 42"))).toEqual({ selection: "all", status: "active" });
  });

  it("does not process a redelivery twice", async () => {
    const { request, db } = apiHarness(app);
    await db.exec("INSERT INTO tenants (id, name) VALUES ('acme', 'Acme'); INSERT INTO tenant_installations (installation_id, tenant_id, account, selection) VALUES (42, 'acme', 'acme-corp', 'all')");
    const first = delivery({ action: "deleted", installation: { id: 42 } });
    expect((await request("/webhooks/github", first)).status).toBe(202);
    await db.exec("UPDATE tenant_installations SET status = 'active'");
    expect((await request("/webhooks/github", first)).body).toMatchObject({ duplicate: true });
    expect((await db.one("SELECT status FROM tenant_installations"))).toEqual({ status: "active" });
  });
});

describe("issue webhooks", () => {
  const deliver = (body: object) => {
    const raw = JSON.stringify(body);
    return { raw, auth: false as const, method: "POST", headers: { "x-hub-signature-256": sign(raw, WEBHOOK_SECRET), "x-github-event": "issues", "x-github-delivery": crypto.randomUUID() } };
  };
  const issue = (installation: number, title: string, updatedAt = "2026-11-26T20:00:00Z") => ({
    action: "edited",
    installation: { id: installation },
    repository: { full_name: "shared/repo" },
    issue: { number: 7, title, body: "Beschreibung\n\n### Abnahmekriterien\nGrün", state: "open", html_url: "https://github.com/shared/repo/issues/7", updated_at: updatedAt },
  });

  it("only changes tasks of the tenant that owns the sending installation", async () => {
    const { request, db } = apiHarness(app);
    await db.exec(`
      INSERT INTO tenants (id, name) VALUES ('acme', 'Acme'), ('beta', 'Beta');
      INSERT INTO tenant_installations (installation_id, tenant_id, account, selection) VALUES (42, 'acme', 'shared', 'all'), (43, 'beta', 'shared', 'all');
      INSERT INTO projects (id, tenant_id, name, repo, status) VALUES ('p-acme', 'acme', 'repo', 'shared/repo', 'active'), ('p-beta', 'beta', 'repo', 'shared/repo', 'active');
      INSERT INTO tasks (id, tenant_id, project_id, title, status, github_issue_number) VALUES ('t-acme', 'acme', 'p-acme', 'alt', 'backlog', 7), ('t-beta', 'beta', 'p-beta', 'alt', 'backlog', 7);
    `);
    const result = await request("/webhooks/github", deliver(issue(42, "Neu von Acme")));
    expect(result.body).toMatchObject({ synced: 1 });
    const titles = (await db.rows("SELECT id, title, acceptance_criteria FROM tasks ORDER BY id"));
    expect(titles).toEqual([
      { id: "t-acme", title: "Neu von Acme", acceptance_criteria: "Grün" },
      { id: "t-beta", title: "alt", acceptance_criteria: null },
    ]);
    // An older update than the stored one changes nothing.
    expect((await request("/webhooks/github", deliver(issue(42, "veraltet", "2026-11-26T19:00:00Z")))).body).toMatchObject({ ignored: "stale_issue_update" });
    // An installation nobody connected does not reach another tenant's tasks.
    expect((await request("/webhooks/github", deliver(issue(99, "fremd")))).body).toMatchObject({ ignored: "unlinked_issue" });
  });
});
