import { timingSafeEqual } from "node:crypto";
import { describe, expect, it } from "vitest";
import api from "../apps/api/src/index.ts";
import type { Env } from "../apps/api/src/env.ts";
import { finishRun, recordModelCall, recordToolCall, spentTodayFromLedger, startRun } from "../apps/api/src/usage/ledger.ts";
import { parseFilter, toCsv } from "../apps/api/src/usage/routes.ts";
import { sqliteD1 } from "./_helpers/sqlite-d1.ts";

(crypto.subtle as unknown as { timingSafeEqual?: unknown }).timingSafeEqual ??= (a: ArrayBuffer, b: ArrayBuffer) => timingSafeEqual(Buffer.from(a), Buffer.from(b));

const RUN = "11111111-1111-4111-8111-111111111111";
const OTHER_RUN = "22222222-2222-4222-8222-222222222222";

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
  } as unknown as Env;
  async function call(path: string) {
    const response = await api.fetch(
      new Request(`https://api.test${path}`, { headers: { authorization: "Bearer service-token", "x-portal-actor": "owner@test" } }),
      env,
      {} as ExecutionContext,
    );
    const type = response.headers.get("content-type") ?? "";
    return { status: response.status, type, body: type.includes("json") ? ((await response.json()) as never) : ((await response.text()) as never) };
  }
  return { db, env, call };
}

async function seed(env: Env) {
  const now = Date.now();
  {
    await startRun(env, { id: RUN, tenantId: "owner", agentId: "chef", projectId: "uguroezdamar", threadId: "t1", kind: "chat", startedAt: now - 5_000 });
    await recordModelCall(env, {
      tenantId: "owner", runId: RUN, agentId: "chef", projectId: "uguroezdamar", threadId: "t1", step: 1, alias: "chef-smart",
      provider: "deepseek", model: "deepseek-flash", status: "ok", tokensIn: 10_000, tokensOut: 500, cacheReadTokens: 6_000,
      inputUsdPerM: 0.3, outputUsdPerM: 1.2, priceSource: "catalog", costUsd: 0.0036, latencyMs: 1200, firstTokenMs: 300, keySource: "tenant", attempts: ["deepseek/deepseek-flash: ok"],
    });
    await recordToolCall(env, { tenantId: "owner", runId: RUN, agentId: "chef", projectId: "uguroezdamar", step: 1, tool: "repo_read_file", argsPreview: '{"path":"README.md"}', ok: true, durationMs: 80, resultPreview: "# uguroezdamar" });
    await recordModelCall(env, {
      tenantId: "owner", runId: RUN, agentId: "chef", projectId: "uguroezdamar", threadId: "t1", step: 2, alias: "chef-smart",
      provider: "deepseek", model: "deepseek-flash", status: "ok", tokensIn: 11_000, tokensOut: 300, inputUsdPerM: 0.3, outputUsdPerM: 1.2, costUsd: 0.00366, latencyMs: 900,
    });
    await recordModelCall(env, { tenantId: "owner", runId: RUN, agentId: "chef", step: 3, provider: "router", model: "chef-smart", status: "error", error: "=HYPERLINK(\"x\")" });
    await finishRun(env, "owner", RUN, "done", { steps: 3, stages: 1, outcome: "Fertig." });
    await startRun(env, { id: OTHER_RUN, tenantId: "acme", agentId: "chef", kind: "chat", startedAt: now });
    await recordModelCall(env, { tenantId: "acme", runId: OTHER_RUN, agentId: "chef", provider: "anthropic", model: "claude-sonnet-5-5", status: "ok", tokensIn: 1_000, tokensOut: 100, costUsd: 0.5 });
  }
}

describe("usage ledger", () => {
  it("adds model and tool calls up on the run and counts the budget from the ledger", async () => {
    const { env, db } = setup();
    await seed(env);
    const run = db.raw.prepare("SELECT status, steps, model_calls, tool_calls, tokens_in, tokens_out, cost_usd, outcome FROM runs WHERE id = ?").get(RUN) as Record<string, number | string>;
    expect(run).toMatchObject({ status: "done", steps: 3, model_calls: 3, tool_calls: 1, tokens_in: 21_000, tokens_out: 800, outcome: "Fertig." });
    expect(Number(run.cost_usd)).toBeCloseTo(0.00726, 6);
    expect(await spentTodayFromLedger(env, "owner", "chef")).toBeCloseTo(0.00726, 6);
    // A finished run is not reopened by a late write.
    await finishRun(env, "owner", RUN, "failed", { outcome: "später" });
    expect(db.raw.prepare("SELECT status FROM runs WHERE id = ?").get(RUN)).toEqual({ status: "done" });
  });

  it("summarises by agent, model, project and day for the caller's tenant only", async () => {
    const { env, call } = setup();
    await seed(env);
    const summary = (await call("/api/usage/summary")).body as {
      totals: { calls: number; errors: number; costUsd: number; cacheReadTokens: number };
      byModel: { key: string; calls: number }[];
      byProject: { key: string; label: string }[];
      byDay: unknown[];
      budgets: { agentId: string; spentUsd: number; warning: boolean }[];
      runs: { runs: number };
    };
    expect(summary.totals).toMatchObject({ calls: 3, errors: 1, cacheReadTokens: 6_000 });
    expect(summary.totals.costUsd).toBeCloseTo(0.00726, 6);
    expect(summary.byModel.map((row) => row.key)).toEqual(["deepseek/deepseek-flash", "router/chef-smart"]);
    expect(summary.byProject[0]).toMatchObject({ key: "uguroezdamar", label: "uguroezdamar.com" });
    expect(summary.byDay).toHaveLength(1);
    expect(summary.runs.runs).toBe(1);
    expect(summary.budgets.find((row) => row.agentId === "chef")?.warning).toBe(false);

    const filtered = (await call("/api/usage/summary?provider=router")).body as { totals: { calls: number } };
    expect(filtered.totals.calls).toBe(1);
    const calls = (await call("/api/usage/calls?model=deepseek-flash")).body as { provider: string; agent: string }[];
    expect(calls).toHaveLength(2);
    expect(calls.every((row) => row.provider === "deepseek")).toBe(true);
  });

  it("shows one run's trace and never another tenant's", async () => {
    const { env, call } = setup();
    await seed(env);
    const trace = (await call(`/api/usage/runs/${RUN}`)).body as { run: { status: string }; modelCalls: { step: number; attempts: string[] }[]; toolCalls: { tool: string; durationMs: number }[] };
    expect(trace.run.status).toBe("done");
    expect(trace.modelCalls.map((row) => row.step)).toEqual([1, 2, 3]);
    expect(trace.modelCalls[0]?.attempts).toEqual(["deepseek/deepseek-flash: ok"]);
    expect(trace.toolCalls).toEqual([expect.objectContaining({ tool: "repo_read_file", durationMs: 80 })]);
    expect((await call(`/api/usage/runs/${OTHER_RUN}`)).status).toBe(404);
    const runs = (await call("/api/usage/runs")).body as { id: string }[];
    expect(runs.map((row) => row.id)).toEqual([RUN]);
  });

  it("exports CSV that a spreadsheet cannot turn into a formula", async () => {
    const { env, call } = setup();
    await seed(env);
    const csv = await call("/api/usage/export.csv");
    expect(csv.type).toContain("text/csv");
    const lines = String(csv.body).split("\n");
    expect(lines[0]).toMatch(/^ts,agent,projectId,runId/);
    expect(lines).toHaveLength(4);
    expect(String(csv.body)).toContain(`"'=HYPERLINK(""x"")"`);
    expect(toCsv([{ ts: 0, agent: "a,b" }])).toContain('"a,b"');
  });

  it("reads dates as whole UTC days and defaults to the last 30 days", () => {
    const filter = parseFilter(new URLSearchParams("from=2026-11-01&to=2026-11-02&agent=chef&model=bad value"), Date.parse("2026-11-26T12:00:00Z"));
    expect(new Date(filter.from).toISOString()).toBe("2026-11-01T00:00:00.000Z");
    expect(new Date(filter.to).toISOString()).toBe("2026-11-02T23:59:59.999Z");
    expect(filter).toMatchObject({ agentId: "chef", model: undefined });
    const fallback = parseFilter(new URLSearchParams(), Date.parse("2026-11-26T12:00:00Z"));
    expect(fallback.to - fallback.from).toBe(30 * 86_400_000);
  });
});
