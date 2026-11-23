import { describe, expect, it } from "vitest";

import { hasMatchingProtectionBypass, type VercelProject } from "../tooling/cli/src/lib/vercel";

describe("Vercel deployment protection bypass", () => {
	it("matches the stored secret in memory without exposing it", () => {
		const secret = "private-test-token";
		const project = { protectionBypass: { [secret]: { createdAt: 1 } } } as VercelProject;

		expect(hasMatchingProtectionBypass(project, secret)).toBe(true);
		expect(hasMatchingProtectionBypass(project, "another-token")).toBe(false);
		expect(hasMatchingProtectionBypass(project, undefined)).toBe(false);
		expect(hasMatchingProtectionBypass({} as VercelProject, secret)).toBe(false);
	});
});
