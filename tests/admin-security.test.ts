import { createHash } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";

let adminServer: typeof import("@ugur/server");
beforeAll(async () => {
  process.env.ADMIN_API_KEY = "local-test-pepper";
  adminServer = await import("@ugur/server");
});

describe("admin password security", () => {
  it("stores passwords with Argon2id and rejects incorrect passwords", async () => {
    const hash = await adminServer.hashPassword("correct horse battery staple");

    expect(hash.startsWith("$argon2id$")).toBe(true);
    await expect(adminServer.verifyPassword("correct horse battery staple", hash)).resolves.toEqual({
      valid: true,
      needsRehash: false,
    });
    await expect(adminServer.verifyPassword("wrong password", hash)).resolves.toEqual({
      valid: false,
      needsRehash: false,
    });
  }, 15_000);

  it("accepts a valid legacy hash only to trigger an Argon2id upgrade", async () => {
    const password = "legacy password";
    const legacyHash = createHash("sha256")
      .update(password + "local-test-pepper")
      .digest("hex");

    const result = await adminServer.verifyPassword(password, legacyHash);
    expect(result).toEqual({ valid: true, needsRehash: true });
    await expect(adminServer.verifyPassword("incorrect", legacyHash)).resolves.toEqual({
      valid: false,
      needsRehash: false,
    });
  });
});

describe("admin role capabilities", () => {
  it.each(["owner", "admin"] as const)("allows %s to invite and delete admins", (role) => {
    const admin = {
      email: "role-test@example.com",
      passwordHash: "not-used",
      createdAt: new Date(),
      status: "active" as const,
      role,
    };
    expect(adminServer.canInvite(admin)).toBe(true);
    expect(adminServer.canDelete(admin)).toBe(true);
  });

  it("does not grant admin capabilities to editors or anonymous users", () => {
    const editor = {
      email: "editor-test@example.com",
      passwordHash: "not-used",
      createdAt: new Date(),
      status: "active" as const,
      role: "editor" as const,
    };
    expect(adminServer.canInvite(editor)).toBe(false);
    expect(adminServer.canDelete(editor)).toBe(false);
    expect(adminServer.canInvite(null)).toBe(false);
    expect(adminServer.canDelete(null)).toBe(false);
  });
});
