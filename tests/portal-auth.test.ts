import { describe, it, expect } from "vitest";

describe("portal auth boundary", () => {
  it("GET /api/me returns 401 when unauthenticated", async () => {
    const { GET } = await import("../apps/portal/app/api/me/route");
    const res = await GET(new Request("http://localhost/api/me"));
    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data).toMatchObject({ ok: false, error: "Unauthorized" });
  });
});
