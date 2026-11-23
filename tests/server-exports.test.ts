import { describe, expect, it } from "vitest";
import * as server from "@ugur/server";

describe("@ugur/server exports", () => {
  it("exposes the contact and admin use cases", () => {
    for (const name of ["createContactRequest", "listContactRequests", "consumeContactRateLimit", "createAdminSession", "listAdmins"] as const) {
      expect(typeof server[name], name).toBe("function");
    }
  });

  it("no longer carries the content CMS or its storage (ADR 0019)", () => {
    const names = Object.keys(server);
    expect(names.filter((name) => /project|career|profile|upload|deleteObject/i.test(name))).toEqual([]);
    // The retired CMS tables stay separate from the new metadata-only GitHub source catalog.
    expect(Object.keys(server.schema).sort()).toEqual([
      "adminInvites", "adminLoginAttempts", "adminSessions", "admins", "careerEntries",
      "contactRateLimits", "contactRequests", "portfolioGithubRepositories", "profiles", "projects",
    ]);
  });
});
