import { afterEach, describe, expect, it, vi } from "vitest";
import { SubrequestBudget } from "../apps/api/src/runtime/budget.ts";
import type { ToolContext } from "../apps/api/src/tools/port.ts";
import { toolByName } from "../apps/api/src/tools/registry.ts";
import { ciState, logTail } from "../apps/api/src/tools/verify.ts";
import { apiHarness } from "./_helpers/api-env.ts";

/** code_verify (plan stage 4): one tool, two ways. Without a workstation it reads the repository's CI for free. */
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
const tool = toolByName("code_verify")!;

function contextFor(env: ToolContext["env"]): ToolContext {
  return { env, tenantId: "owner", agentId: "chef", threadId: "t-1", projectId: "uguroezdamar", repo: "devUgur/uguroezdamar.com", budget: new SubrequestBudget() };
}

function stubGithub(checkRuns: unknown[], extra: (url: string) => Response | undefined = () => undefined) {
  const calls: string[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string | URL) => {
      const url = String(input);
      calls.push(url);
      const answer = extra(url);
      if (answer) return answer;
      if (url.endsWith("/repos/devUgur/uguroezdamar.com")) return json({ full_name: "devUgur/uguroezdamar.com", private: false, default_branch: "main" });
      if (url.includes("/check-runs?")) return json({ check_runs: checkRuns });
      if (url.includes("/annotations")) return json([{ path: "src/a.ts", start_line: 3, annotation_level: "failure", message: "Type 'x' is not assignable" }]);
      return json({ message: "Not Found" }, 404);
    }),
  );
  return calls;
}

const run = (fields: Record<string, unknown>) => ({ id: 11, name: "check", status: "completed", conclusion: "success", html_url: "https://github.com/x", app: { slug: "github-actions" }, ...fields });

describe("CI state", () => {
  it("lets a failure win over pending and success, and knows when there is no CI", () => {
    expect(ciState([])).toBe("no_ci");
    expect(ciState([{ status: "completed", conclusion: "success" }, { status: "completed", conclusion: "skipped" }])).toBe("passed");
    expect(ciState([{ status: "in_progress", conclusion: null }, { status: "completed", conclusion: "success" }])).toBe("pending");
    expect(ciState([{ status: "in_progress", conclusion: null }, { status: "completed", conclusion: "failure" }])).toBe("failed");
  });

  it("keeps the end of a log without timestamps and tokens", () => {
    const log = logTail(`2026-11-26T10:00:00.1234567Z start\n${"x".repeat(50)}\n2026-11-26T10:00:01.0Z error ghs_abcdefghijklmnopqrstuvwxyz0123`, 40);
    expect(log.startsWith("…")).toBe(true);
    expect(log).toContain("error [geschwärzt]");
    expect(log).not.toContain("2026-11-26T");
  });
});

describe("code_verify over CI", () => {
  it("reports green checks", async () => {
    stubGithub([run({})]);
    const { env } = apiHarness({ AGENT_GITHUB_TOKEN: "test-token" });
    const result = (await tool.run({ ref: "agent/fix" }, contextFor(env))) as Record<string, unknown>;
    expect(result).toMatchObject({ way: "ci", state: "passed", ref: "agent/fix", failures: [] });
  });

  it("returns the end of the failed job's log", async () => {
    stubGithub([run({ conclusion: "failure" })], (url) => (url.endsWith("/actions/jobs/11/logs") ? new Response("2026-11-26T10:00:00Z FAIL tests/a.test.ts\nexpected 1 to be 2") : undefined));
    const { env } = apiHarness({ AGENT_GITHUB_TOKEN: "test-token" });
    const result = (await tool.run({ ref: "agent/fix" }, contextFor(env))) as { state: string; failures: { source: string; log: string }[] };
    expect(result.state).toBe("failed");
    expect(result.failures[0]).toMatchObject({ source: "job_log" });
    expect(result.failures[0]!.log).toContain("expected 1 to be 2");
  });

  it("falls back to the annotations when the log is not readable", async () => {
    stubGithub([run({ conclusion: "failure", output: { title: "1 error" } })], (url) => (url.endsWith("/logs") ? json({ message: "Resource not accessible by integration" }, 403) : undefined));
    const { env } = apiHarness({ AGENT_GITHUB_TOKEN: "test-token" });
    const result = (await tool.run({ ref: "agent/fix" }, contextFor(env))) as { failures: { source: string; log: string }[] };
    expect(result.failures[0]).toMatchObject({ source: "annotations" });
    expect(result.failures[0]!.log).toContain("src/a.ts:3 Type 'x' is not assignable");
  });

  it("waits briefly for running checks and then hands back pending", async () => {
    vi.useFakeTimers();
    const calls = stubGithub([run({ status: "in_progress", conclusion: null })]);
    const { env } = apiHarness({ AGENT_GITHUB_TOKEN: "test-token" });
    const pending = tool.run({ ref: "agent/fix" }, contextFor(env));
    await vi.runAllTimersAsync();
    expect(await pending).toMatchObject({ state: "pending" });
    expect(calls.filter((url) => url.includes("/check-runs?"))).toHaveLength(3);
  });

  it("says when the repository has no CI", async () => {
    stubGithub([]);
    const { env } = apiHarness({ AGENT_GITHUB_TOKEN: "test-token" });
    const result = (await tool.run({ ref: "main" }, contextFor(env))) as { state: string; next: string };
    expect(result.state).toBe("no_ci");
    expect(result.next).toMatch(/keine CI/);
  });

  it("needs no approval and works on the company level with an explicit repository", async () => {
    expect(tool.requiresApproval).toBeFalsy();
    expect(tool.requiresProject).toBeFalsy();
    stubGithub([run({})]);
    const { env } = apiHarness({ AGENT_GITHUB_TOKEN: "test-token" });
    const company = { ...contextFor(env), projectId: "", repo: "" };
    await expect(tool.run({ ref: "main" }, company)).rejects.toThrow(/Firmenebene/);
    expect(await tool.run({ ref: "main", repo: "devUgur/uguroezdamar.com" }, company)).toMatchObject({ state: "passed" });
  });
});
