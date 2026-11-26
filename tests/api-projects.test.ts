import { afterEach, describe, expect, it, vi } from "vitest";
import { ModelRouter } from "../apps/api/src/models/router.ts";
import { createRepository, listRepositories, ProjectError, registerProject, unregisterProject } from "../apps/api/src/projects/repositories.ts";
import { describeApproval } from "../apps/api/src/approvals.ts";
import { workspaceTools } from "../apps/api/src/tools/workspace.ts";
import { githubTools } from "../apps/api/src/tools/github.ts";
import { SubrequestBudget } from "../apps/api/src/runtime/budget.ts";
import type { Env } from "../apps/api/src/env.ts";
import type { ToolContext } from "../apps/api/src/tools/port.ts";

interface ProjectRow {
  tenant_id?: string;
  id: string;
  repo: string;
  status: string;
  visibility: string;
  default_branch: string;
  write_mode: string;
}

const tenantOf = (row: ProjectRow): string => row.tenant_id ?? "owner";

/** In-memory stand-in for the few D1 queries these modules run; it dispatches on the SQL text. */
interface InstallRow {
  tenant_id: string;
  installation_id: number;
  account: string;
  selection: string;
}

function fakeDb(projects: ProjectRow[], installs: InstallRow[] = []) {
  return {
    projects,
    prepare(sql: string) {
      let args: unknown[] = [];
      const statement = {
        bind: (...values: unknown[]) => {
          args = values;
          return statement;
        },
        all: async () => ({
          results: sql.includes("FROM tenant_installations") ? installs.filter((row) => row.tenant_id === args[0]) : sql.includes("SELECT id, repo FROM projects") ? projects.filter((row) => row.status === "active" && tenantOf(row) === args[0]) : [],
        }),
        first: async () => {
          if (sql.includes("lower(repo)")) return projects.find((row) => tenantOf(row) === args[0] && row.repo.toLowerCase() === String(args[1]).toLowerCase()) ?? null;
          if (sql.includes("SELECT 1 FROM projects WHERE id")) return projects.find((row) => row.id === args[0]) ?? null;
          if (sql.includes("SELECT default_branch, write_mode")) {
            const row = projects.find((entry) => tenantOf(entry) === args[0] && entry.repo === args[1] && entry.status === "active");
            return row ? { default_branch: row.default_branch, write_mode: row.write_mode } : null;
          }
          return null;
        },
        run: async () => {
          if (sql.startsWith("INSERT INTO projects")) {
            const [id, tenant, , repo, visibility, defaultBranch] = args as string[];
            projects.push({ id: id ?? "", tenant_id: tenant, repo: repo ?? "", status: "active", visibility: visibility ?? "", default_branch: defaultBranch ?? "", write_mode: "pr-only" });
            return { meta: { changes: 1 } };
          }
          if (sql.includes("SET status = 'archived'")) {
            const row = projects.find((entry) => tenantOf(entry) === args[0] && entry.id === args[1] && entry.status === "active");
            if (row) row.status = "archived";
            return { meta: { changes: row ? 1 : 0 } };
          }
          return { meta: { changes: 1 } };
        },
      };
      return statement;
    },
  };
}

function envWith(projects: ProjectRow[] = [], extra: Record<string, unknown> = {}, installs: InstallRow[] = []) {
  const db = fakeDb(projects, installs);
  const env = {
    DB: db,
    CONFIG: { get: async () => null },
    AI: { run: vi.fn(async () => ({ response: "antwort von workers ai", usage: { prompt_tokens: 1, completion_tokens: 1 } })) },
    AGENT_GITHUB_TOKEN: "test-token",
    GITHUB_OWNERS: "devUgur",
    ...extra,
  };
  return { env: env as unknown as Env, db, ai: env.AI };
}

const repoJson = (over: Record<string, unknown> = {}) => ({
  full_name: "devUgur/notes",
  name: "notes",
  owner: { login: "devUgur" },
  private: true,
  default_branch: "main",
  archived: false,
  fork: false,
  description: null,
  pushed_at: null,
  ...over,
});

function stubGithub(handler: (url: string) => unknown) {
  const calls: string[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string | URL) => {
      const url = String(input);
      calls.push(url);
      const body = handler(url);
      if (body instanceof Response) return body;
      return new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });
    }),
  );
  return calls;
}

afterEach(() => vi.unstubAllGlobals());

describe("registering repositories as projects", () => {
  it("lists only repositories of allowed owners and marks registered ones", async () => {
    stubGithub(() => [repoJson(), repoJson({ full_name: "viralsync-app/platform", name: "platform", owner: { login: "viralsync-app" } })]);
    const { env } = envWith([{ id: "notes", repo: "devUgur/notes", status: "active", visibility: "private", default_branch: "main", write_mode: "pr-only" }]);
    const repos = await listRepositories(env, "owner");
    expect(repos.map((repo) => repo.fullName)).toEqual(["devUgur/notes"]);
    expect(repos[0]?.projectId).toBe("notes");
  });

  it("refuses malformed names and owners that are not allowed, without calling GitHub", async () => {
    const calls = stubGithub(() => repoJson());
    const { env } = envWith();
    await expect(registerProject(env, "owner", "no-slash")).rejects.toMatchObject({ status: 400 });
    await expect(registerProject(env, "owner", "viralsync-app/platform")).rejects.toMatchObject({ status: 403 });
    await expect(registerProject(env, "owner", "devUgur/../x")).rejects.toBeInstanceOf(ProjectError);
    expect(calls).toHaveLength(0);
  });

  it("takes visibility and default branch from GitHub, not from the caller, and refuses archived repositories", async () => {
    const { env, db } = envWith();
    stubGithub(() => repoJson({ private: true, default_branch: "trunk" }));
    const created = await registerProject(env, "owner", "devUgur/notes");
    expect(created).toEqual({ id: "notes", created: true });
    expect(db.projects[0]).toMatchObject({ visibility: "private", default_branch: "trunk", write_mode: "pr-only" });

    stubGithub(() => repoJson({ archived: true }));
    await expect(registerProject(env, "owner", "devUgur/other")).rejects.toMatchObject({ status: 409 });
  });

  it("registers the same repository only once and never removes the main project", async () => {
    const { env, db } = envWith();
    stubGithub(() => repoJson());
    await registerProject(env, "owner", "devUgur/notes");
    expect(await registerProject(env, "owner", "devUgur/notes")).toEqual({ id: "notes", created: false });
    expect(db.projects).toHaveLength(1);
    expect(await unregisterProject(env, "owner", "notes")).toBe(true);
    expect(await unregisterProject(env, "owner", "notes")).toBe(false);
    await expect(unregisterProject(env, "owner", "uguroezdamar")).rejects.toMatchObject({ status: 409 });
  });

  it("explains a missing token instead of failing silently", async () => {
    const { env } = envWith([], { AGENT_GITHUB_TOKEN: undefined });
    await expect(listRepositories(env, "owner")).rejects.toMatchObject({ status: 503 });
  });
});

describe("private repositories and models", () => {
  const messages = [{ role: "user" as const, content: "hallo" }];

  it("keeps a private project away from providers that may train on content", async () => {
    const { env, ai } = envWith([], { GEMINI_API_KEY: "key" });
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    const router = await ModelRouter.load(env);
    const result = await router.chat("chef-smart", { messages }, { privateContent: true, budget: new SubrequestBudget() });
    expect(result.target.provider).toBe("workers-ai");
    expect(fetchSpy).not.toHaveBeenCalled(); // Gemini was never asked
    expect(ai.run).toHaveBeenCalledOnce();
  });

  it("fails clearly when no provider without training is left, and treats a pinned Gemini model the same way", async () => {
    const { env } = envWith([], { GEMINI_API_KEY: "key" });
    const router = await ModelRouter.load(env);
    const pinned = { provider: "gemini", model: "gemini-flash-latest" };
    await expect(router.chat("no-such-alias", { messages }, { privateContent: true })).rejects.toThrow(/Unknown model alias/);
    const result = await router.chat("chef-smart", { messages }, { privateContent: true, pinned });
    expect(result.target.provider).toBe("workers-ai");
  });

  it("still lets public projects use every provider", async () => {
    const { env } = envWith([], { GEMINI_API_KEY: "key" });
    stubGithub(() => ({ choices: [{ message: { role: "assistant", content: "von gemini" } }], usage: {} }));
    const router = await ModelRouter.load(env);
    const result = await router.chat("chef-smart", { messages }, { budget: new SubrequestBudget() });
    expect(result.target.provider).toBe("gemini");
  });
});

describe("write rules per project", () => {
  const commit = githubTools.find((tool) => tool.spec.name === "repo_commit_files");
  const args = (branch: string) => ({ branch, message: "m", files: [{ path: "a.txt", content: "x" }] });

  function contextFor(row: Partial<ProjectRow>): ToolContext {
    const { env } = envWith([
      { id: "p", repo: "devUgur/notes", status: "active", visibility: "private", default_branch: "main", write_mode: "pr-only", ...row },
    ]);
    return { env, tenantId: "owner", agentId: "chef", projectId: "p", repo: "devUgur/notes", budget: new SubrequestBudget() };
  }

  it("lets pr-only projects write to agent branches only, never to dev or the default branch", async () => {
    for (const branch of ["main", "dev", "feature/x"]) {
      await expect(commit?.run(args(branch), contextFor({}))).rejects.toThrow(/agent\//);
    }
  });

  it("lets a dev-first project write to dev but never to its default branch", async () => {
    const context = contextFor({ write_mode: "dev-first" });
    await expect(commit?.run(args("main"), context)).rejects.toThrow(/nie auf main/);
    // The branch gate passes for dev: the next thing that fails is the (stubbed) network, not the rule.
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("network reached"); }));
    await expect(commit?.run(args("dev"), context)).rejects.toThrow(/network reached/);
  });

  it("treats a repository without a registered project like the strictest case", async () => {
    const { env } = envWith();
    const context: ToolContext = { env, tenantId: "owner", agentId: "chef", projectId: "x", repo: "devUgur/unknown", budget: new SubrequestBudget() };
    await expect(commit?.run(args("dev"), context)).rejects.toThrow(/agent\//);
  });
});

describe("answering questions about repositories", () => {
  const tool = (name: string) => workspaceTools.find((entry) => entry.spec.name === name);
  const rows = (visibility: string): ProjectRow[] => [
    { id: "p", repo: "devUgur/open", status: "active", visibility, default_branch: "main", write_mode: "pr-only" },
  ];
  const stubRepos = () =>
    stubGithub(() => [
      repoJson({ full_name: "devUgur/open", name: "open", private: false }),
      repoJson({ full_name: "devUgur/secret-client", name: "secret-client" }),
      repoJson({ full_name: "devUgur/old", name: "old", archived: true }),
    ]);

  it("counts every repository of the account, names the private ones and marks the thread private first", async () => {
    stubRepos();
    const { env } = envWith(rows("public"));
    const marked = vi.fn(async () => undefined);
    const context: ToolContext = { env, tenantId: "owner", agentId: "chef", projectId: "p", repo: "devUgur/open", budget: new SubrequestBudget(), markPrivate: marked };
    const result = (await tool("github_repositories_list")?.run({}, context)) as { total: number; private: number; registered: number; repositories: { fullName: string }[] };
    expect(result).toMatchObject({ total: 2, private: 1, registered: 1 });
    expect(result.repositories.map((repo) => repo.fullName)).toEqual(["devUgur/open", "devUgur/secret-client"]);
    expect(marked).toHaveBeenCalledOnce();
  });

  it("leaves the thread unmarked when the account has no private repository", async () => {
    stubGithub(() => [repoJson({ full_name: "devUgur/open", name: "open", private: false })]);
    const { env } = envWith(rows("public"));
    const marked = vi.fn(async () => undefined);
    await tool("github_repositories_list")?.run({}, { env, tenantId: "owner", agentId: "chef", projectId: "p", repo: "devUgur/open", budget: new SubrequestBudget(), markPrivate: marked });
    expect(marked).not.toHaveBeenCalled();
  });

  it("counts the GitHub call against the subrequest budget", async () => {
    stubRepos();
    const { env } = envWith(rows("public"));
    const budget = new SubrequestBudget();
    await tool("github_repositories_list")?.run({}, { env, tenantId: "owner", agentId: "chef", projectId: "p", repo: "devUgur/open", budget });
    expect(budget.spent).toBe(1);
  });
});

describe("private content follows the model the chat is pinned to", () => {
  it("treats a pinned Workers AI or Modal model as private-safe and a pinned Gemini model as not", async () => {
    const { env } = envWith([]);
    const router = await ModelRouter.load(env);
    expect(router.keepsContentPrivate({ provider: "workers-ai", model: "@cf/meta/llama-3.3-70b-instruct-fp8-fast" })).toBe(true);
    expect(router.keepsContentPrivate({ provider: "modal", model: "mistralai/Ministral-3-8B-Instruct-2512" })).toBe(true);
    expect(router.keepsContentPrivate({ provider: "gemini", model: "gemini-flash-latest" })).toBe(false);
    expect(router.keepsContentPrivate({ provider: "modal", model: "unbekannt" })).toBe(false);
  });
});

describe("reading other repositories of the account", () => {
  const readFile = githubTools.find((tool) => tool.spec.name === "repo_read_file");
  const listFiles = githubTools.find((tool) => tool.spec.name === "repo_list_files");
  const base = (): ProjectRow[] => [{ id: "p", repo: "devUgur/main", status: "active", visibility: "public", default_branch: "main", write_mode: "dev-first" }];
  const contextFor = (marked = vi.fn(async () => undefined)) => {
    const { env } = envWith(base());
    return { context: { env, tenantId: "owner", agentId: "chef", projectId: "p", repo: "devUgur/main", budget: new SubrequestBudget(), markPrivate: marked } as ToolContext, marked };
  };
  const stubRepo = (isPrivate: boolean) =>
    stubGithub((url) => {
      if (url.endsWith("/repos/devUgur/notes")) return repoJson({ private: isPrivate, default_branch: "trunk" });
      return [{ name: "README.md", type: "file", size: 1 }];
    });

  it("reads an unregistered repository of an allowed owner from its own default branch", async () => {
    const calls = stubRepo(false);
    const { context, marked } = contextFor();
    const result = (await listFiles?.run({ repo: "devUgur/notes" }, context)) as { repo: string; ref: string };
    expect(result).toMatchObject({ repo: "devUgur/notes", ref: "trunk" });
    expect(calls.some((url) => url.includes("/repos/devUgur/notes/contents/?ref=trunk"))).toBe(true);
    expect(marked).not.toHaveBeenCalled();
  });

  it("marks the thread private before returning content of a private repository", async () => {
    stubRepo(true);
    const order: string[] = [];
    const { context } = contextFor(vi.fn(async () => void order.push("marked")));
    await listFiles?.run({ repo: "devUgur/notes" }, context);
    order.push("returned");
    expect(order).toEqual(["marked", "returned"]);
  });

  it("refuses other owners and malformed names without calling GitHub", async () => {
    const calls = stubRepo(false);
    const { context } = contextFor();
    await expect(readFile?.run({ repo: "viralsync-app/platform", path: "a" }, context)).rejects.toThrow(/keinen Zugriff/);
    await expect(readFile?.run({ repo: "kaputt", path: "a" }, context)).rejects.toThrow(/owner\/name/);
    expect(calls).toEqual([]);
  });

  it("keeps writing on the repository of the chat, whatever repo the model names", async () => {
    const calls = stubGithub(() => ({ object: { sha: "abc" } }));
    const { context } = contextFor();
    const commit = githubTools.find((tool) => tool.spec.name === "repo_commit_files");
    await commit?.run({ repo: "devUgur/notes", branch: "dev", message: "m", files: [{ path: "a.txt", content: "x" }] }, context).catch(() => undefined);
    expect(calls.length).toBeGreaterThan(0);
    expect(calls.every((url) => url.includes("/repos/devUgur/main/"))).toBe(true);
  });
});

describe("registering and creating repositories through approvals", () => {
  /** Answers /user, POST /user/repos and the lookup that registration does afterwards; records every call. */
  function stubAccount(login: string, createStatus = 201) {
    const calls: { method: string; url: string; body: unknown }[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL, init?: RequestInit) => {
        const url = String(input);
        const method = init?.method ?? "GET";
        calls.push({ method, url, body: init?.body ? JSON.parse(String(init.body)) : undefined });
        if (url.endsWith("/user")) return new Response(JSON.stringify({ login }), { status: 200 });
        if (method === "POST") {
          const requested = calls.at(-1)?.body as { name: string; private: boolean };
          return new Response(JSON.stringify(repoJson({ full_name: `${login}/${requested.name}`, name: requested.name, private: requested.private })), { status: createStatus });
        }
        return new Response(JSON.stringify(repoJson({ full_name: url.split("/repos/")[1], name: String(url.split("/").at(-1)) })), { status: 200 });
      }),
    );
    return calls;
  }

  it("creates a private repository on the own account and registers it as a pr-only project", async () => {
    const calls = stubAccount("devUgur");
    const { env, db } = envWith();
    const result = await createRepository(env, "owner", { name: "neues-projekt", description: "Test" });
    expect(result).toMatchObject({ fullName: "devUgur/neues-projekt", private: true, projectId: "neues-projekt" });
    expect(calls.find((call) => call.method === "POST")?.body).toMatchObject({ name: "neues-projekt", private: true, auto_init: true });
    expect(db.projects[0]).toMatchObject({ repo: "devUgur/neues-projekt", write_mode: "pr-only", status: "active" });
  });

  it("refuses accounts that are not allowed and bad names before creating anything", async () => {
    const calls = stubAccount("fremd");
    const { env } = envWith();
    await expect(createRepository(env, "owner", { name: "x" })).rejects.toThrow(/nicht freigegeben/);
    await expect(createRepository(env, "owner", { name: "../boese" })).rejects.toThrow(/Ungültiger/);
    expect(calls.some((call) => call.method === "POST")).toBe(false);
  });

  it("explains the missing token permission instead of a bare GitHub error", async () => {
    stubAccount("devUgur", 403);
    const { env } = envWith();
    await expect(createRepository(env, "owner", { name: "x" })).rejects.toThrow(/Administration/);
  });

  it("only proposes both actions: they need approval and show as security relevant", () => {
    for (const name of ["project_register", "repo_create"]) {
      expect(workspaceTools.find((tool) => tool.spec.name === name)?.requiresApproval).toBe(true);
    }
    expect(describeApproval("project_register", { repo: "devUgur/video-lab" })).toMatchObject({ risk: "security" });
    const publicRepo = describeApproval("repo_create", { name: "x", private: false });
    expect(publicRepo.summary).toContain("öffentlich");
    expect(publicRepo.warnings.join(" ")).toContain("ÖFFENTLICH");
    expect(describeApproval("repo_create", { name: "x" }).summary).toContain("privat");
  });
});

describe("two tenants side by side", () => {
  const acmeInstall: InstallRow = { tenant_id: "acme", installation_id: 9, account: "devUgur", selection: "all" };
  const ownerProject: ProjectRow = { id: "notes", tenant_id: "owner", repo: "devUgur/notes", status: "active", visibility: "private", default_branch: "main", write_mode: "dev-first" };

  it("refuses another tenant the owner's token: without its own app installation it cannot reach GitHub", async () => {
    const { env, db } = envWith([{ ...ownerProject }], {}, [acmeInstall]);
    stubGithub(() => repoJson());
    await expect(registerProject(env, "acme", "devUgur/notes")).rejects.toMatchObject({ status: 403 });
    await expect(listRepositories(env, "acme")).rejects.toMatchObject({ status: 403 });
    expect(db.projects).toEqual([ownerProject]);
  });

  it("does not let one tenant remove another tenant's project", async () => {
    const { env, db } = envWith([{ ...ownerProject }]);
    expect(await unregisterProject(env, "acme", "notes")).toBe(false);
    expect(db.projects[0]?.status).toBe("active");
  });

  it("treats a repository registered by another tenant as unregistered: the strictest write rule applies", async () => {
    const { env } = envWith([{ ...ownerProject }]);
    const context: ToolContext = { env, tenantId: "acme", agentId: "chef", projectId: "x", repo: "devUgur/notes", budget: new SubrequestBudget() };
    const commit = githubTools.find((tool) => tool.spec.name === "repo_commit_files");
    // The owner's project is dev-first, which would allow dev; for acme the repository is unknown, so only agent/ branches pass.
    await expect(commit?.run({ branch: "dev", message: "m", files: [{ path: "a.txt", content: "x" }] }, context)).rejects.toThrow(/agent\//);
  });
});
