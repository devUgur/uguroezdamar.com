import { afterEach, describe, expect, it, vi } from "vitest";

describe("health endpoints", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("site: stays 200 without a database and reports commit and client address", async () => {
    vi.stubEnv("RENDER_GIT_COMMIT", "0123456789abcdef");
    const { GET } = await import("../apps/site/app/api/health/route");
    const response = await GET(new Request("http://localhost/api/health", { headers: { "cf-connecting-ip": "198.51.100.7" } }));
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toEqual({
      ok: true,
      app: "site",
      commit: "0123456789abcdef",
      database: "unavailable",
      client: "198.51.100.7",
    });
  });

  it("site: reports no client address when the proxy header is missing", async () => {
    const { GET } = await import("../apps/site/app/api/health/route");
    const body = await (await GET(new Request("http://localhost/api/health"))).json();
    expect(body).toMatchObject({ commit: null, client: null });
  });

  it("portal: stays 200 without a database", async () => {
    const { GET } = await import("../apps/portal/app/api/health/route");
    const response = await GET();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, app: "portal", commit: null, database: "unavailable" });
  });
});
