import { describe, it, expect, beforeAll } from "vitest";
import fs from "fs";
import { resolve } from "path";

// Load .env if present
const envPath = resolve(process.cwd(), ".env");
if (fs.existsSync(envPath)) {
  const raw = fs.readFileSync(envPath, "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    const [, k, rawV] = m;
    let v = rawV;
    if ((v.startsWith("\"") && v.endsWith("\"")) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    if (!process.env[k]) process.env[k] = v;
  }
}

const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
  // Skip tests if no DB configured
  console.warn("Skipping admin session tests: MONGODB_URI not set");
}

describe("admin session flows (integration)", () => {
  if (!MONGODB_URI) {
    it("skipped", () => {
      expect(true).toBe(true);
    });
    return;
  }

  // Import helpers lazily so env is set
  let admin: typeof import("@ugur/server");
  beforeAll(async () => {
    admin = await import("@ugur/server");
  });

  it("creates, reads and deletes a session", async () => {
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

  it("records and clears failed login attempts", async () => {
    const ip = "127.0.0.2";
    await admin.recordFailedLoginAttempt(ip);
    const count = await admin.countRecentFailedLoginAttempts(ip, 60);
    expect(count).toBeGreaterThanOrEqual(1);

    await admin.clearLoginAttempts(ip);
    const count2 = await admin.countRecentFailedLoginAttempts(ip, 60);
    expect(count2).toBe(0);
  });
});
