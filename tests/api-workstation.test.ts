import { afterEach, describe, expect, it, vi } from "vitest";
import { SubrequestBudget } from "../apps/api/src/runtime/budget.ts";
import type { ToolContext } from "../apps/api/src/tools/port.ts";
import { toolByName } from "../apps/api/src/tools/registry.ts";
import { DAILY_RUNS_PER_TENANT, assertRef, redact, stepsFor, tail } from "../apps/api/src/workstation/commands.ts";
import { gitGateway, previewGateway, registryGateway } from "../apps/api/src/cloudflare/gateways.ts";
import type { WorkstationJob, WorkstationResult } from "../apps/api/src/workstation/port.ts";
import { previewAlias, previewUrl, previewWorkerName, versionIdFrom } from "../apps/api/src/workstation/previews.ts";
import { Workstation } from "../apps/api/src/cloudflare/workstation-object.ts";
import { apiHarness } from "./_helpers/api-env.ts";

afterEach(() => vi.unstubAllGlobals());

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

/** Plays GitHub for the read tools: one public repository of the allowed owner and the registered project. */
function stubGithub() {
  const calls: string[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string | URL) => {
      const url = String(input);
      calls.push(url);
      if (url.endsWith("/repos/devUgur/hello-world")) return json({ full_name: "devUgur/hello-world", private: false, default_branch: "main" });
      if (url.endsWith("/repos/devUgur/uguroezdamar.com")) return json({ full_name: "devUgur/uguroezdamar.com", private: false, default_branch: "main" });
      if (url.includes("/contents/wrangler.jsonc")) return json({ type: "file" });
      if (url.includes("/contents/")) return json({ message: "Not Found" }, 404);
      if (url.endsWith("/pulls/7")) return json({ head: { sha: "a".repeat(40) } });
      return json({ message: "Not Found" }, 404);
    }),
  );
  return calls;
}

/** A workstation namespace whose objects record the job and answer like a finished run. */
function fakeWorkstations(answer: (job: WorkstationJob) => Partial<WorkstationResult> = () => ({})) {
  const jobs: { name: string; job: WorkstationJob }[] = [];
  return {
    jobs,
    namespace: {
      get: (name: string) => ({
        run: async (job: WorkstationJob): Promise<WorkstationResult> => {
          jobs.push({ name, job });
          return {
            runId: job.runId,
            commit: "c".repeat(40),
            ok: true,
            failedAt: null,
            durationMs: 61_000,
            steps: [
              { name: "install", command: "pnpm install --frozen-lockfile", exitCode: 0, durationMs: 20_000, output: "Done", truncated: false },
              { name: job.command, command: `pnpm ${job.command}`, exitCode: 0, durationMs: 41_000, output: "Tests 12 passed", truncated: false },
            ],
            ...answer(job),
          };
        },
      }),
    },
  };
}

function contextFor(env: ToolContext["env"], extra: Partial<ToolContext> = {}): ToolContext {
  return { env, tenantId: "owner", agentId: "chef", threadId: "thread-1", projectId: "uguroezdamar", repo: "devUgur/uguroezdamar.com", budget: new SubrequestBudget(), ...extra };
}

describe("allowed commands", () => {
  it("always installs first and drops --frozen-lockfile without a lockfile", () => {
    expect(stepsFor("check", true).map((step) => step.argv.join(" "))).toEqual(["pnpm install --frozen-lockfile", "pnpm check"]);
    expect(stepsFor("check", false)[0]?.argv).toEqual(["pnpm", "install"]);
    expect(stepsFor("install", true)).toHaveLength(1);
  });

  it("refuses refs that git could read as options or paths out of the repository", () => {
    expect(assertRef("agent/fix-footer")).toBe("agent/fix-footer");
    expect(() => assertRef("--upload-pack=evil")).toThrow();
    expect(() => assertRef("main;rm -rf /")).toThrow();
    expect(() => assertRef("a/../b")).toThrow();
  });

  it("redacts credentials and keeps the end of long output", () => {
    expect(redact("token ghs_abcdefghijklmnopqrstuvwxyz0123 used")).toBe("token [geschwärzt] used");
    expect(redact("https://x-access-token:secret@github.com/a/b")).toBe("https://[geschwärzt]@github.com/a/b");
    const long = tail(`${"x".repeat(20_000)}ERROR at the end`, 100);
    expect(long.truncated).toBe(true);
    expect(long.text.endsWith("ERROR at the end")).toBe(true);
  });
});

describe("preview naming", () => {
  it("derives worker, alias and URL by one rule for every project", () => {
    const worker = previewWorkerName("uguroezdamar");
    expect(worker).toBe("pv-uguroezdamar");
    expect(previewAlias(worker, { pullRequest: 12 })).toBe("pr-12");
    expect(previewAlias(worker, { branch: "agent/Fix_Footer" })).toBe("agent-fix-footer");
    expect(previewAlias(worker, { branch: "123-hotfix" })).toMatch(/^[a-z]/);
    expect(previewUrl("pr-12", worker, "acme")).toBe("https://pr-12-pv-uguroezdamar.acme.workers.dev");
  });

  it("keeps alias and worker within one DNS label", () => {
    const worker = previewWorkerName("a-very-long-project-identifier-that-goes-on-and-on");
    const alias = previewAlias(worker, { branch: "agent/an-extremely-long-branch-name-that-would-break-dns-labels" });
    expect(`${alias}-${worker}`.length).toBeLessThanOrEqual(63);
  });

  it("reads the version id wrangler prints", () => {
    expect(versionIdFrom("Uploaded pv-x\nWorker Version ID: 0f8a4c1e-1111-2222-3333-444455556666\n")).toBe("0f8a4c1e-1111-2222-3333-444455556666");
  });
});

describe("sandbox_run", () => {
  const tool = toolByName("sandbox_run");

  it("runs a check against a public repository in its own workstation and records the run", async () => {
    stubGithub();
    const workstations = fakeWorkstations();
    const { env, db, kv } = apiHarness({ WORKSTATION: workstations.namespace, AGENT_GITHUB_TOKEN: "test-token" });
    const markPrivate = vi.fn(async () => undefined);

    const result = (await tool!.run({ command: "check", repo: "devUgur/hello-world" }, contextFor(env, { markPrivate }))) as Record<string, unknown>;

    expect(workstations.jobs).toHaveLength(1);
    const { name, job } = workstations.jobs[0]!;
    expect(job).toMatchObject({ tenantId: "owner", repo: "devUgur/hello-world", ref: "main", private: false, command: "check" });
    expect(name).toBe(`ws:owner:${job.runId}`);
    expect(JSON.stringify(job)).not.toContain("test-token");
    expect(result).toMatchObject({ repo: "devUgur/hello-world", ref: "main", ok: true, commit: "c".repeat(40) });
    expect(markPrivate).not.toHaveBeenCalled();

    const event = await db.prepare("SELECT type, data FROM events WHERE tenant_id = 'owner' AND type = 'sandbox_run'").first<{ data: string }>();
    expect(JSON.parse(event!.data)).toMatchObject({ runId: job.runId, repo: "devUgur/hello-world", command: "check", ok: true, instanceType: "standard-1" });
    expect([...kv.entries()].find(([key]) => key.startsWith("workstation:runs:owner:"))?.[1]).toBe("1");
  });

  it("gives every run a container of its own", async () => {
    stubGithub();
    const workstations = fakeWorkstations();
    const { env } = apiHarness({ WORKSTATION: workstations.namespace, AGENT_GITHUB_TOKEN: "test-token" });
    await tool!.run({ command: "test", repo: "devUgur/hello-world" }, contextFor(env));
    await tool!.run({ command: "test", repo: "devUgur/hello-world" }, contextFor(env));
    expect(new Set(workstations.jobs.map((entry) => entry.name)).size).toBe(2);
  });

  it("refuses commands outside the allowlist and repositories of other owners", async () => {
    stubGithub();
    const workstations = fakeWorkstations();
    const { env } = apiHarness({ WORKSTATION: workstations.namespace, AGENT_GITHUB_TOKEN: "test-token" });
    await expect(tool!.run({ command: "rm -rf /" }, contextFor(env))).rejects.toThrow(/Befehl muss/);
    await expect(tool!.run({ command: "check", repo: "someone/else" }, contextFor(env))).rejects.toThrow(/keinen Zugriff/);
    expect(workstations.jobs).toHaveLength(0);
  });

  it("says so when the container is not activated, without using up the daily quota", async () => {
    stubGithub();
    const { env, kv } = apiHarness({ AGENT_GITHUB_TOKEN: "test-token" });
    await expect(tool!.run({ command: "check" }, contextFor(env))).rejects.toThrow(/nicht eingerichtet/);
    expect([...kv.keys()].some((key) => key.startsWith("workstation:runs:"))).toBe(false);
  });

  it("stops at the daily limit of a tenant", async () => {
    stubGithub();
    const workstations = fakeWorkstations();
    const { env, kv } = apiHarness({ WORKSTATION: workstations.namespace, AGENT_GITHUB_TOKEN: "test-token" });
    kv.set(`workstation:runs:owner:${new Date().toISOString().slice(0, 10)}`, String(DAILY_RUNS_PER_TENANT));
    await expect(tool!.run({ command: "check" }, contextFor(env))).rejects.toThrow(/Tageslimit/);
    expect(workstations.jobs).toHaveLength(0);
  });

  it("needs no approval; preview_deploy does", () => {
    expect(tool!.requiresApproval).toBeFalsy();
    expect(toolByName("preview_deploy")!.requiresApproval).toBe(true);
  });
});

describe("preview_deploy", () => {
  const tool = toolByName("preview_deploy");
  const configured = (workstations: ReturnType<typeof fakeWorkstations>) =>
    apiHarness({ WORKSTATION: workstations.namespace, AGENT_GITHUB_TOKEN: "test-token", CF_WORKERS_SUBDOMAIN: "acme", AGENT_CF_PREVIEW_TOKEN: "cf-token", CF_ACCOUNT_ID: "acct" });

  it("uploads a version with the pull request's alias and lists the URL for the project", async () => {
    stubGithub();
    const workstations = fakeWorkstations((job) => ({
      steps: [{ name: "upload", command: "wrangler versions upload", exitCode: 0, durationMs: 9_000, output: "Worker Version ID: 0f8a4c1e-1111-2222-3333-444455556666", truncated: false }],
      commit: job.ref,
    }));
    const harness = configured(workstations);

    const result = await tool!.run({ pullRequest: 7 }, contextFor(harness.env));

    const job = workstations.jobs[0]!.job;
    expect(job).toMatchObject({ command: "preview", ref: "a".repeat(40), preview: { workerName: "pv-uguroezdamar", alias: "pr-7" } });
    expect(JSON.stringify(job)).not.toContain("cf-token");
    expect(result).toMatchObject({ url: "https://pr-7-pv-uguroezdamar.acme.workers.dev", versionId: "0f8a4c1e-1111-2222-3333-444455556666" });

    const listed = await harness.request("/api/projects/uguroezdamar/previews");
    expect(listed.status).toBe(200);
    expect(listed.body).toMatchObject({ available: true, previews: [{ ref: "#7", alias: "pr-7", url: "https://pr-7-pv-uguroezdamar.acme.workers.dev", status: "ready" }] });
  });

  it("refuses repositories without a wrangler configuration", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => json({ message: "Not Found" }, 404)));
    const workstations = fakeWorkstations();
    await expect(tool!.run({ branch: "dev" }, contextFor(configured(workstations).env))).rejects.toThrow(/Wrangler-Konfiguration/);
    expect(workstations.jobs).toHaveLength(0);
  });

  it("is unavailable until subdomain and token are set", async () => {
    const { env } = apiHarness({ WORKSTATION: fakeWorkstations().namespace });
    await expect(tool!.run({ branch: "dev" }, contextFor(env))).rejects.toThrow(/nicht eingerichtet/);
  });
});

describe("gateways", () => {
  const props = { tenantId: "owner", repo: "devUgur/hello-world", private: false };
  const seen: Request[] = [];
  const passThrough = () => {
    seen.length = 0;
    vi.stubGlobal("fetch", vi.fn(async (request: Request) => (seen.push(request), new Response("ok"))));
  };

  it("lets git clone the run's repository and nothing else", async () => {
    passThrough();
    const env = apiHarness().env;
    const refs = await gitGateway(new Request("https://github.com/devUgur/hello-world.git/info/refs?service=git-upload-pack"), env, props);
    const pack = await gitGateway(new Request("https://github.com/devUgur/hello-world.git/git-upload-pack", { method: "POST" }), env, props);
    expect([refs.status, pack.status]).toEqual([200, 200]);

    const push = await gitGateway(new Request("https://github.com/devUgur/hello-world.git/info/refs?service=git-receive-pack"), env, props);
    const other = await gitGateway(new Request("https://github.com/devUgur/secret.git/info/refs?service=git-upload-pack"), env, props);
    expect([push.status, other.status]).toEqual([403, 403]);
    expect(seen).toHaveLength(2);
  });

  it("adds the installation credential in the Worker for private repositories only", async () => {
    passThrough();
    const env = apiHarness({ AGENT_GITHUB_TOKEN: "test-token" }).env;
    await gitGateway(new Request("https://github.com/devUgur/hello-world.git/info/refs?service=git-upload-pack", { headers: { authorization: "Basic forged" } }), env, props);
    expect(seen[0]!.headers.get("authorization")).toBeNull();
    await gitGateway(new Request("https://github.com/devUgur/hello-world.git/info/refs?service=git-upload-pack"), env, { ...props, private: true });
    expect(seen[1]!.headers.get("authorization")).toBe(`Basic ${btoa("x-access-token:test-token")}`);
  });

  it("allows only reading from the npm registry", async () => {
    passThrough();
    expect((await registryGateway(new Request("https://registry.npmjs.org/vitest"))).status).toBe(200);
    expect((await registryGateway(new Request("https://registry.npmjs.org/-/user", { method: "PUT" }))).status).toBe(403);
  });

  it("reaches only the project's preview Worker on the Cloudflare API", async () => {
    passThrough();
    const env = apiHarness({ AGENT_CF_PREVIEW_TOKEN: "cf-token", CF_ACCOUNT_ID: "acct" }).env;
    const scoped = { ...props, previewWorker: "pv-hello" };
    const upload = await previewGateway(new Request("https://api.cloudflare.com/client/v4/accounts/acct/workers/scripts/pv-hello/versions", { method: "POST" }), env, scoped);
    const otherWorker = await previewGateway(new Request("https://api.cloudflare.com/client/v4/accounts/acct/workers/scripts/uguroezdamar-api", { method: "PUT" }), env, scoped);
    const listing = await previewGateway(new Request("https://api.cloudflare.com/client/v4/accounts/acct/workers/scripts"), env, scoped);
    expect([upload.status, otherWorker.status, listing.status]).toEqual([200, 403, 403]);
    expect(seen[0]!.headers.get("authorization")).toBe("Bearer cf-token");
  });
});

/** A container that records what it was asked and answers every exec with the given exit code. */
function fakeContainer(exitCodeOf: (argv: string[]) => number) {
  const calls = { started: [] as { enableInternet: boolean; env?: Record<string, string> }[], intercepted: [] as string[], exec: [] as string[][], destroyed: 0 };
  const container = {
    running: false,
    start(options: { enableInternet: boolean; env?: Record<string, string> }) {
      calls.started.push(options);
      container.running = true;
    },
    async interceptOutboundHttps(host: string) {
      calls.intercepted.push(host);
    },
    async setInactivityTimeout() {},
    async destroy() {
      calls.destroyed += 1;
      container.running = false;
    },
    async exec(argv: string[]) {
      calls.exec.push(argv);
      const code = exitCodeOf(argv);
      return { output: async () => ({ stdout: new TextEncoder().encode(argv.includes("rev-parse") ? "abc123\n" : `ran ${argv.join(" ")}`).buffer, stderr: new ArrayBuffer(0), exitCode: code }) };
    },
  };
  const storage = { setAlarm: vi.fn(async () => undefined), deleteAlarm: vi.fn(async () => undefined), deleteAll: vi.fn(async () => undefined) };
  const gateway = () => ({}) as Fetcher;
  const ctx = { container, storage, exports: { GitGateway: gateway, RegistryGateway: gateway, PreviewGateway: gateway } };
  return { calls, storage, workstation: new Workstation(ctx as never, { CF_ACCOUNT_ID: "acct" } as never) };
}

describe("Workstation durable object", () => {
  const job: WorkstationJob = { runId: "r1", tenantId: "owner", repo: "devUgur/hello-world", ref: "main", private: false, command: "check" };

  it("starts without Internet, reaches only the gateways, runs every step under a time limit and cleans up", async () => {
    const { calls, storage, workstation } = fakeContainer(() => 0);
    const result = await workstation.run(job);

    expect(calls.started).toEqual([expect.objectContaining({ enableInternet: false })]);
    expect(calls.intercepted).toEqual(["github.com", "registry.npmjs.org"]);
    expect(JSON.stringify(calls.started[0]!.env)).not.toMatch(/token/i);
    const steps = calls.exec.filter((argv) => argv[0] === "timeout");
    expect(steps.map((argv) => argv.slice(4).join(" "))).toEqual([
      "git init --quiet /workspace/repo",
      "git -C /workspace/repo remote add origin https://github.com/devUgur/hello-world.git",
      "git -C /workspace/repo fetch --depth 1 --quiet origin main",
      "git -C /workspace/repo checkout --quiet --detach FETCH_HEAD",
      "pnpm install --frozen-lockfile",
      "pnpm check",
    ]);
    expect(result).toMatchObject({ ok: true, commit: "abc123", failedAt: null });
    expect(calls.destroyed).toBe(1);
    expect(storage.deleteAll).toHaveBeenCalled();
  });

  it("stops at the first failing step and still destroys the container", async () => {
    const { calls, workstation } = fakeContainer((argv) => (argv.includes("check") ? 1 : 0));
    const result = await workstation.run(job);
    expect(result).toMatchObject({ ok: false, failedAt: "check" });
    expect(calls.destroyed).toBe(1);
  });

  it("destroys the container when a call throws", async () => {
    const { calls, workstation } = fakeContainer((argv) => {
      if (argv.includes("fetch")) throw new Error("container crashed");
      return 0;
    });
    await expect(workstation.run(job)).rejects.toThrow("container crashed");
    expect(calls.destroyed).toBe(1);
  });

  it("intercepts the Cloudflare API only for preview uploads", async () => {
    const { calls, workstation } = fakeContainer(() => 0);
    await workstation.run({ ...job, command: "preview", preview: { workerName: "pv-hello", alias: "pr-1" } });
    expect(calls.intercepted).toContain("api.cloudflare.com");
    expect(calls.exec.some((argv) => argv.includes("--preview-alias") && argv.includes("pr-1"))).toBe(true);
    expect(calls.started[0]!.env?.CLOUDFLARE_API_TOKEN).toBe("via-gateway");
  });

  it("cleans up from the alarm when a run never finished", async () => {
    const { calls, workstation } = fakeContainer(() => 0);
    (workstation as unknown as { ctx: { container: { running: boolean } } }).ctx.container.running = true;
    await workstation.alarm();
    expect(calls.destroyed).toBe(1);
  });
});
