import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { proxy } from "../apps/portal/proxy";

const call = (path: string, headers: Record<string, string> = {}) =>
  proxy(new NextRequest(`http://localhost${path}`, { headers }));

describe("portal proxy", () => {
  it("answers 401 for an API call with neither session cookie nor API key", async () => {
    expect((await call("/api/admins")).status).toBe(401);
  });

  it("lets an API call with a bearer token through to the handler, which validates it", async () => {
    const response = await call("/api/admins", { authorization: "Bearer anything" });
    expect(response.status).toBe(200);
    expect(response.headers.get("x-middleware-next")).toBe("1");
  });

  it("keeps the health endpoint public and sends pages to the login", async () => {
    expect((await call("/api/health")).headers.get("x-middleware-next")).toBe("1");
    const page = await call("/admin/team");
    expect(page.status).toBe(307);
    expect(page.headers.get("location")).toContain("/login?next=%2Fadmin%2Fteam");
  });
});
