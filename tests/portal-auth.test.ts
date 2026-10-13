import { describe, it, expect } from "vitest";

describe("portal auth boundary", () => {
  it("GET /api/admins returns 401 when unauthenticated", async () => {
    const { GET } = await import("../apps/portal/app/api/admins/route");
    const res = await GET(new Request("http://localhost/api/admins"));
    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data).toMatchObject({ error: "Unauthorized" });
  });
});
