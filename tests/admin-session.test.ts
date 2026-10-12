import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { useTestDatabase } from "./_helpers/test-db";

describe("admin accounts, invites and sessions (Postgres integration)", () => {
  let admin: typeof import("@ugur/server");
  let close: () => Promise<void>;
  beforeAll(async () => {
    process.env.APP_URL = "http://localhost:3001";
    ({ server: admin, close } = await useTestDatabase());
  });
  afterAll(() => close());

  const tokenOf = (inviteUrl: string) => new URL(inviteUrl).searchParams.get("token") ?? "";

  it("turns an invite into exactly one account", async () => {
    const invite = await admin.createAdminInvite("New.Admin@Example.com", "owner@example.com", "admin");
    expect(invite.ok).toBe(true);
    await expect(admin.createAdminInvite("new.admin@example.com", "owner@example.com")).resolves.toMatchObject({
      ok: false,
      error: "An active invite already exists",
    });

    const token = tokenOf(invite.inviteUrl ?? "");
    const results = await Promise.all([
      admin.acceptAdminInvite(token, "a sufficiently long password"),
      admin.acceptAdminInvite(token, "a sufficiently long password"),
    ]);
    expect(results.filter((result) => result.ok)).toHaveLength(1);

    const created = await admin.getAdminByEmail("NEW.ADMIN@example.com");
    expect(created).toMatchObject({ email: "new.admin@example.com", role: "admin", status: "active" });
    expect(created?.passwordHash.startsWith("$argon2id$")).toBe(true);
    await expect(admin.acceptAdminInvite(token, "another long password")).resolves.toMatchObject({ ok: false });
    await expect(admin.acceptAdminInvite("unknown-token", "another long password")).resolves.toMatchObject({
      ok: false,
      error: "Invalid token",
    });
  }, 30_000);

  it("never returns password hashes from the admin list", async () => {
    const list = await admin.listAdmins();
    expect(list.length).toBeGreaterThan(0);
    for (const entry of list) expect(entry).not.toHaveProperty("passwordHash");
  });

  it("creates, reads and deletes a session", async () => {
    const account = await admin.getAdminByEmail("new.admin@example.com");
    const session = await admin.createAdminSession({
      adminId: account!.id,
      email: account!.email,
      userAgent: "vitest",
      ip: "127.0.0.1",
    });
    expect(session.id).toMatch(/^[0-9a-f-]{36}$/);

    expect(await admin.getAdminSession(session.id)).toMatchObject({ id: session.id, adminId: account!.id });
    expect(await admin.getAdminSession("not-a-session-id")).toBeNull();
    expect(await admin.getAdminSession(null)).toBeNull();

    await admin.deleteAdminSession(session.id);
    expect(await admin.getAdminSession(session.id)).toBeNull();
  });

  it("expires sessions and removes them with their account", async () => {
    const account = await admin.getAdminByEmail("new.admin@example.com");
    const expired = await admin.createAdminSession({ adminId: account!.id, email: account!.email });
    await admin
      .getDb()
      .update(admin.schema.adminSessions)
      .set({ expiresAt: new Date(Date.now() - 1000) });
    expect(await admin.getAdminSession(expired.id)).toBeNull();

    const live = await admin.createAdminSession({ adminId: account!.id, email: account!.email });
    await admin.recordAdminLogin(account!.id);
    expect((await admin.getAdminById(account!.id))?.lastLogin).toBeInstanceOf(Date);
    expect(await admin.updateAdminRoleById(account!.id, "owner")).toMatchObject({ role: "owner" });
    expect(await admin.countOwners()).toBe(1);

    expect(await admin.deleteAdminById(account!.id)).toBe(true);
    expect(await admin.getAdminSession(live.id)).toBeNull();
  });

  it("records and clears failed login attempts", async () => {
    const ip = "127.0.0.2";
    await admin.recordFailedLoginAttempt(ip);
    await admin.recordFailedLoginAttempt(ip);
    expect(await admin.countRecentFailedLoginAttempts(ip, 60)).toBe(2);
    expect(await admin.countRecentFailedLoginAttempts("127.0.0.3", 60)).toBe(0);

    await admin.clearLoginAttempts(ip);
    expect(await admin.countRecentFailedLoginAttempts(ip, 60)).toBe(0);
  });
});
