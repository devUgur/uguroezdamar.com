import { describe, it, expect, beforeAll } from "vitest";
const testMongoUri = process.env.TEST_MONGODB_URI;

if (testMongoUri) {
  const parsed = new URL(testMongoUri);
  if (!new Set(["localhost", "127.0.0.1", "[::1]"]).has(parsed.hostname)) {
    throw new Error("TEST_MONGODB_URI must point to a local MongoDB instance.");
  }
  process.env.MONGODB_URI = testMongoUri;
}

describe("admin session flows (integration)", () => {
  // Import helpers lazily so env is set
  let admin: typeof import("@ugur/server");
  beforeAll(async () => {
    admin = await import("@ugur/server");
  });

  const integrationTest = testMongoUri ? it : it.skip;

  integrationTest("creates, reads and deletes a session", async () => {
    const s = await admin.createAdminSession({
      adminId: "vitest-admin",
      email: "vitest@example.com",
      userAgent: "vitest",
      ip: "127.0.0.1",
    });
    expect(s).toBeTruthy();
    expect(s._id).toBeDefined();

    const got = await admin.getAdminSession(s._id);
    expect(got).not.toBeNull();
    if (got) expect(got._id).toBe(s._id);

    await admin.deleteAdminSession(s._id);
    const gone = await admin.getAdminSession(s._id);
    expect(gone).toBeNull();
  });

  integrationTest("records and clears failed login attempts", async () => {
    const ip = "127.0.0.2";
    await admin.recordFailedLoginAttempt(ip);
    const count = await admin.countRecentFailedLoginAttempts(ip, 60);
    expect(count).toBeGreaterThanOrEqual(1);

    await admin.clearLoginAttempts(ip);
    const count2 = await admin.countRecentFailedLoginAttempts(ip, 60);
    expect(count2).toBe(0);
  });
});
