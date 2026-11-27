import { describe, expect, it } from "vitest";
import { cloudflareUsage } from "../apps/api/src/cloudflare/usage.ts";
import { infraUsage } from "../apps/api/src/usage/infra.ts";
import type { Env } from "../apps/api/src/env.ts";

/** The usage view (docs/operations/cloudflare-usage.md): numbers from the host, limits and warnings from the core. */
function answer() {
  return {
    data: {
      viewer: {
        accounts: [
          {
            workers: [{ sum: { requests: 1200 } }],
            objects: [{ sum: { requests: 80_000 } }],
            d1: [{ sum: { rowsRead: 40_000, rowsWritten: 900 } }],
            kv: [
              { sum: { requests: 300 }, dimensions: { actionType: "read" } },
              { sum: { requests: 20 }, dimensions: { actionType: "write" } },
              { sum: { requests: 5 }, dimensions: { actionType: "delete" } },
            ],
          },
        ],
      },
    },
  };
}

describe("infrastructure usage", () => {
  it("asks Cloudflare once for today and keeps the answer five minutes", async () => {
    const bodies: { variables: { account: string; day: string } }[] = [];
    const fetcher = (async (_url: string, init: RequestInit) => {
      bodies.push(JSON.parse(String(init.body)));
      expect(new Headers(init.headers).get("authorization")).toBe("Bearer token");
      return Response.json(answer());
    }) as typeof fetch;
    const port = cloudflareUsage("token", "account", fetcher);
    const first = await port.today();
    await port.today();
    expect(bodies).toHaveLength(1);
    expect(bodies[0]?.variables.account).toBe("account");
    expect(first.day).toBe(new Date().toISOString().slice(0, 10));
    expect(Object.fromEntries(first.measures.map((measure) => [measure.key, measure.used]))).toEqual({
      "workers.requests": 1200,
      "do.requests": 80_000,
      "d1.rowsRead": 40_000,
      "d1.rowsWritten": 900,
      "kv.reads": 300,
      "kv.writes": 25,
    });
  });

  it("does not keep a failed answer", async () => {
    let calls = 0;
    const fetcher = (async () => (++calls === 1 ? Response.json({ data: null, errors: [{ message: "denied" }] }) : Response.json(answer()))) as unknown as typeof fetch;
    const port = cloudflareUsage("token", "account", fetcher);
    await expect(port.today()).rejects.toThrow("denied");
    await expect(port.today()).resolves.toMatchObject({ measures: expect.any(Array) });
    expect(calls).toBe(2);
  });

  it("adds limits and warns from 70 percent, for the owner only", async () => {
    const env = { INFRA_USAGE: cloudflareUsage("token", "account", (async () => Response.json(answer())) as unknown as typeof fetch) } as unknown as Env;
    const view = await infraUsage(env, "owner");
    expect(view.available).toBe(true);
    expect(view.measures.find((measure) => measure.key === "do.requests")).toMatchObject({ limit: 100_000, share: 0.8, warn: true });
    expect(view.measures.find((measure) => measure.key === "kv.writes")).toMatchObject({ limit: 1_000, warn: false });
    expect(await infraUsage(env, "acme")).toMatchObject({ available: false, measures: [] });
    expect(await infraUsage({} as Env, "owner")).toMatchObject({ available: false, reason: expect.stringContaining("CF_ANALYTICS_TOKEN") });
  });
});
