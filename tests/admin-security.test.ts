import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { resolve } from "node:path";
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

  it("rejects legacy SHA-256 hashes outright", async () => {
    const password = "legacy password";
    const legacyHash = createHash("sha256")
      .update(password + "local-test-pepper")
      .digest("hex");

    await expect(adminServer.verifyPassword(password, legacyHash)).resolves.toEqual({
      valid: false,
      needsRehash: false,
    });
  });

  it("asks for a rehash when a valid hash uses weaker parameters", async () => {
    // argon2 is a dependency of the server package, not of the workspace root.
    const argon2 = createRequire(resolve(import.meta.dirname, "../packages/server/package.json"))("argon2") as typeof import("argon2");
    const weak = await argon2.hash("correct horse", { type: argon2.argon2id, memoryCost: 8192, timeCost: 2, parallelism: 1 });
    await expect(adminServer.verifyPassword("correct horse", weak)).resolves.toEqual({ valid: true, needsRehash: true });
    await expect(adminServer.verifyPassword("wrong", weak)).resolves.toEqual({ valid: false, needsRehash: false });
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
