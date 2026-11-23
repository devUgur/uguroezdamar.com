import { describe, expect, it, vi } from "vitest";

const { run, withSecrets } = vi.hoisted(() => ({
	run: vi.fn(() => ({ code: 0, stdout: "", stderr: "" })),
	withSecrets: vi.fn(() => ["pnpm", ["--filter", "@ugur/server", "projects:discover", "--", "--apply"]] as [string, string[]]),
}));

vi.mock("../tooling/cli/src/lib/exec.ts", () => ({ run }));
vi.mock("../tooling/cli/src/lib/infisical.ts", () => ({ accessHint: () => "setup required", withSecrets }));

describe("ugur projects discover", () => {
	it("runs a read-only discovery without loading database secrets", async () => {
		run.mockClear();
		withSecrets.mockClear();
		const { discoverProjects } = await import("../tooling/cli/src/commands/projects.ts");

		expect(discoverProjects(false, "dev")).toBe(0);
		expect(run).toHaveBeenCalledWith("pnpm", ["--filter", "@ugur/server", "projects:discover"]);
		expect(withSecrets).not.toHaveBeenCalled();
	});

	it("refuses production sync before reading or writing anything", async () => {
		run.mockClear();
		withSecrets.mockClear();
		const { discoverProjects } = await import("../tooling/cli/src/commands/projects.ts");

		expect(discoverProjects(true, "prod")).toBe(1);
		expect(run).not.toHaveBeenCalled();
		expect(withSecrets).not.toHaveBeenCalled();
	});

	it("uses dev secrets only when the owner explicitly applies the sync", async () => {
		run.mockClear();
		withSecrets.mockClear();
		const { discoverProjects } = await import("../tooling/cli/src/commands/projects.ts");

		expect(discoverProjects(true, "dev")).toBe(0);
		expect(withSecrets).toHaveBeenCalledOnce();
		expect(withSecrets).toHaveBeenCalledWith("dev", ["pnpm", "--filter", "@ugur/server", "projects:discover", "--", "--apply"]);
	});
});

describe("ugur projects inspect", () => {
	it("rejects malformed repositories before invoking GitHub CLI", async () => {
		run.mockClear();
		const { inspectProject } = await import("../tooling/cli/src/commands/projects.ts");
		expect(inspectProject("--help/other")).toBe(1);
		expect(run).not.toHaveBeenCalled();
	});

	it("runs the selected repository inspection without database secrets", async () => {
		run.mockClear();
		withSecrets.mockClear();
		const { inspectProject } = await import("../tooling/cli/src/commands/projects.ts");
		expect(inspectProject("devUgur/portfolio-demo")).toBe(0);
		expect(run).toHaveBeenCalledWith("pnpm", ["--filter", "@ugur/server", "projects:inspect", "devUgur", "portfolio-demo"]);
		expect(withSecrets).not.toHaveBeenCalled();
	});
});
