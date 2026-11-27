import { describe, expect, it } from "vitest";
import { classify, CLASSES, DEFAULT_AUTONOMY, type AutonomyLevel } from "../apps/api/src/policy/catalog.ts";
import { decide, recordDecision } from "../apps/api/src/policy/engine.ts";
import { toolByName } from "../apps/api/src/tools/registry.ts";
import { apiHarness } from "./_helpers/api-env.ts";

/** Phase P2 of ADR 0040: autonomy per project, global limits and a log of every decision about a write. */
const commit = (branch: string, ...paths: string[]) => ({ branch, message: "m", files: paths.map((path) => ({ path, content: "x" })) });
const verdict = (tool: string, args: Record<string, unknown>, level: AutonomyLevel, repo = "devUgur/x") => {
  const spec = toolByName(tool);
  return decide({ tool, args, writes: Boolean(spec?.requiresApproval), needsProject: Boolean(spec?.requiresProject), repo, level }).decision;
};

describe("action catalog", () => {
  it("judges a commit by branch and paths; the riskiest path wins", () => {
    expect(classify("repo_commit_files", commit("agent/x", "src/a.ts")).class).toBe("branch");
    expect(classify("repo_commit_files", commit("dev", "src/a.ts")).class).toBe("dev");
    expect(classify("repo_commit_files", commit("agent/x", "src/a.ts", "package.json")).class).toBe("deps");
    expect(classify("repo_commit_files", commit("agent/x", "package.json", ".github/workflows/ci.yml")).class).toBe("pipeline");
    expect(classify("repo_commit_files", commit("main", "src/a.ts")).class).toBe("release");
    expect(classify("repo_open_pull_request", { branch: "agent/x" }).class).toBe("pr");
    expect(classify("repo_open_pull_request", { branch: "dev" }).class).toBe("release");
    expect(classify("repo_read_file", { path: "x" }).class).toBe("read");
  });

  it("starts every project where it was before the engine: manual", () => {
    expect(DEFAULT_AUTONOMY).toBe("manual");
  });
});

describe("decisions per autonomy level", () => {
  const table: [string, Record<string, unknown>, Record<AutonomyLevel, string>][] = [
    ["repo_read_file", { path: "a" }, { manual: "allow", balanced: "allow", high: "allow", max: "allow" }],
    ["code_verify", { ref: "dev" }, { manual: "allow", balanced: "allow", high: "allow", max: "allow" }],
    ["task_create", { title: "t" }, { manual: "allow", balanced: "allow", high: "allow", max: "allow" }],
    ["repo_commit_files", commit("agent/x", "src/a.ts"), { manual: "approve", balanced: "allow", high: "allow", max: "allow" }],
    ["preview_deploy", { ref: "agent/x" }, { manual: "approve", balanced: "allow", high: "allow", max: "allow" }],
    ["repo_open_pull_request", { branch: "agent/x" }, { manual: "approve", balanced: "approve", high: "allow", max: "allow" }],
    ["repo_commit_files", commit("dev", "src/a.ts"), { manual: "approve", balanced: "approve", high: "approve", max: "allow" }],
    ["repo_commit_files", commit("agent/x", "pnpm-lock.yaml"), { manual: "approve", balanced: "approve", high: "approve", max: "allow" }],
    ["repo_commit_files", commit("agent/x", ".github/workflows/deploy.yml"), { manual: "approve", balanced: "approve", high: "approve", max: "approve" }],
    ["repo_commit_files", commit("agent/x", "apps/api/src/auth.ts"), { manual: "approve", balanced: "approve", high: "approve", max: "approve" }],
    ["repo_open_pull_request", { branch: "dev" }, { manual: "approve", balanced: "approve", high: "approve", max: "approve" }],
    ["repo_create", { name: "neu" }, { manual: "approve", balanced: "approve", high: "approve", max: "approve" }],
    ["project_register", { repo: "o/r" }, { manual: "approve", balanced: "approve", high: "approve", max: "approve" }],
  ];

  for (const [tool, args, expected] of table) {
    it(`${tool} ${JSON.stringify(args).slice(0, 60)}`, () => {
      for (const level of Object.keys(expected) as AutonomyLevel[]) expect(verdict(tool, args, level), level).toBe(expected[level]);
    });
  }

  it("never lets a project lift the global limits", () => {
    for (const [id, rule] of Object.entries(CLASSES)) {
      if (rule.hard) expect(Object.values(rule.levels), id).toEqual(["approve", "approve", "approve", "approve"]);
    }
  });

  it("refuses writing on the company level at every level", () => {
    for (const level of ["manual", "max"] as const) expect(verdict("repo_commit_files", commit("agent/x", "a"), level, "")).toBe("deny");
  });

  it("asks for any writing tool the catalog does not know yet", () => {
    expect(decide({ tool: "brand_new_writer", args: {}, writes: true, needsProject: false, repo: "o/r", level: "max" }).decision).toBe("approve");
  });
});

describe("policy over the API", () => {
  it("lists levels and projects, lets only the owner change a level and protects concurrent edits", async () => {
    const { request } = apiHarness();
    const listed = (await request("/api/policies")).body as { defaultLevel: string; projects: { projectId: string; level: string; version: number }[] };
    expect(listed.defaultLevel).toBe("manual");
    expect(listed.projects.find((project) => project.projectId === "uguroezdamar")).toMatchObject({ level: "manual", version: 0 });

    expect((await request("/api/projects/uguroezdamar/policy", { method: "PUT", body: { level: "balanced", version: 0 } })).status).toBe(403);
    const owner = { "x-portal-scopes": "organization:write" };
    const saved = await request("/api/projects/uguroezdamar/policy", { method: "PUT", body: { level: "balanced", version: 0 }, headers: owner });
    expect(saved.body).toMatchObject({ level: "balanced", version: 1 });
    expect((await request("/api/projects/uguroezdamar/policy", { method: "PUT", body: { level: "max", version: 0 }, headers: owner })).status).toBe(409);
    expect((await request("/api/projects/uguroezdamar/policy", { method: "PUT", body: { level: "irgendwas", version: 1 }, headers: owner })).status).toBe(400);
    expect((await request("/api/projects/gibt-es-nicht/policy", { method: "PUT", body: { level: "high", version: 0 }, headers: owner })).status).toBe(404);
  });

  it("logs decisions about writes, not reads, and serves them newest first", async () => {
    const { env, request } = apiHarness();
    const base = { tenantId: "owner", agentId: "developer", projectId: "uguroezdamar", runId: "r-1" };
    await recordDecision(env.DB, { ...base, tool: "repo_read_file", decision: decide({ tool: "repo_read_file", args: {}, writes: false, needsProject: false, repo: "o/r", level: "manual" }) });
    await recordDecision(env.DB, { ...base, tool: "repo_commit_files", decision: decide({ tool: "repo_commit_files", args: commit("agent/x", "a.ts"), writes: true, needsProject: true, repo: "o/r", level: "balanced" }) });
    const log = (await request("/api/policy/decisions?project=uguroezdamar")).body as { tool: string; decision: string; actionClass: string; policyVersion: string }[];
    expect(log).toHaveLength(1);
    expect(log[0]).toMatchObject({ tool: "repo_commit_files", decision: "allow", actionClass: "branch" });
    expect(log[0]?.policyVersion).toMatch(/^\d{4}-/);
  });
});
