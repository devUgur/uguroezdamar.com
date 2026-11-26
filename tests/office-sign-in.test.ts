import { afterEach, describe, expect, it, vi } from "vitest";
import type { Env } from "../apps/api/src/env.ts";
import { issueHandoff, redeemHandoff } from "../apps/api/src/handoff.ts";
import { safeNext, SESSION_TTL_MS, signSession, verifySession } from "../apps/office/src/adapters/session-token.ts";
import { isOfficeCallback, officeOrigin } from "../apps/portal/src/adapters/office.ts";

/** Sign-in portal → office (ADR 0039): one-time ticket at the API, then a signed session of the office's own. */
afterEach(() => vi.unstubAllEnvs());

function kvEnv() {
  const kv = new Map<string, string>();
  const env = {
    CONFIG: {
      get: async (key: string) => kv.get(key) ?? null,
      put: async (key: string, value: string) => void kv.set(key, value),
      delete: async (key: string) => void kv.delete(key),
    },
  } as unknown as Env;
  return { env, kv };
}

const caller = (actor: string) => ({ actor, tenantId: "owner", scopes: [] });

describe("handoff ticket", () => {
  it("carries the person and owner right once, then is gone", async () => {
    const { env, kv } = kvEnv();
    const { ticket, expiresIn } = await issueHandoff(env, caller("ugur@example.com"), { canManage: true });
    expect(ticket).toMatch(/^[0-9a-f]{64}$/);
    expect(expiresIn).toBe(60);
    expect(await redeemHandoff(env, ticket)).toEqual({ actor: "ugur@example.com", canManage: true });
    expect(await redeemHandoff(env, ticket)).toBeNull();
    expect(kv.size).toBe(0);
  });

  it("refuses a ticket without a signed-in person and malformed tickets", async () => {
    const { env } = kvEnv();
    await expect(issueHandoff(env, caller("portal"), {})).rejects.toThrow(/angemeldete Person/);
    expect(await redeemHandoff(env, "../../etc")).toBeNull();
    expect(await redeemHandoff(env, 42)).toBeNull();
  });

  it("grants owner rights only when the portal says so explicitly", async () => {
    const { env } = kvEnv();
    const { ticket } = await issueHandoff(env, caller("member@example.com"), { canManage: "yes" });
    expect((await redeemHandoff(env, ticket))?.canManage).toBe(false);
  });
});

describe("office session", () => {
  const secret = "service-token-of-the-stage";

  it("round-trips and expires", async () => {
    const exp = Date.now() + SESSION_TTL_MS;
    const value = await signSession({ email: "ugur@example.com", canManage: true, exp }, secret);
    expect(await verifySession(value, secret)).toEqual({ email: "ugur@example.com", canManage: true, exp });
    expect(await verifySession(value, secret, exp + 1)).toBeNull();
  });

  it("rejects a changed payload, another key and garbage", async () => {
    const value = await signSession({ email: "member@example.com", canManage: false, exp: Date.now() + 60_000 }, secret);
    const [, signature] = value.split(".");
    const forged = `${btoa(JSON.stringify({ email: "member@example.com", canManage: true, exp: Date.now() + 60_000 })).replace(/=+$/, "")}.${signature}`;
    expect(await verifySession(forged, secret)).toBeNull();
    expect(await verifySession(value, "another-token")).toBeNull();
    expect(await verifySession("not-a-session", secret)).toBeNull();
    expect(await verifySession(undefined, secret)).toBeNull();
    expect(await verifySession(value, "")).toBeNull();
  });

  it("only returns to paths of the office after sign-in", () => {
    expect(safeNext("/chat/abc?x=1")).toBe("/chat/abc?x=1");
    expect(safeNext("https://evil.example")).toBe("/");
    expect(safeNext("//evil.example")).toBe("/");
    expect(safeNext("/\\evil.example")).toBe("/");
    expect(safeNext(null)).toBe("/");
  });
});

describe("portal return address", () => {
  it("follows the stage and accepts only the office's callback", () => {
    vi.stubEnv("OFFICE_URL", "");
    vi.stubEnv("VERCEL_ENV", "preview");
    expect(officeOrigin()).toBe("https://office-dev.uguroezdamar.com");
    expect(isOfficeCallback("https://office-dev.uguroezdamar.com/auth/callback?next=%2F")).toBe(true);
    expect(isOfficeCallback("https://office-dev.uguroezdamar.com/elsewhere")).toBe(false);
    expect(isOfficeCallback("https://office.uguroezdamar.com.evil.example/auth/callback")).toBe(false);
    expect(isOfficeCallback("javascript:alert(1)")).toBe(false);
    vi.stubEnv("VERCEL_ENV", "production");
    expect(officeOrigin()).toBe("https://office.uguroezdamar.com");
  });
});
