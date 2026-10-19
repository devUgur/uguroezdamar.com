import { afterEach, describe, expect, it } from "vitest";

import { githubCliEnvironment, readmeExcerpt, syncPublicGitHubRepositories, toDiscoveredRepository } from "../packages/server/src/portfolio-catalog/github";
import { useTestDatabase } from "./_helpers/test-db";

const sourceRepository = {
	id: 123456789,
	name: "portfolio-demo",
	owner: { login: "devUgur" },
	visibility: "public",
	private: false,
	description: "  A public demo repository.  ",
	homepage: "https://example.com",
	topics: ["Next.js", "next.js", "Portfolio"],
	default_branch: "main",
	fork: false,
	archived: false,
	updated_at: "2026-10-19T10:00:00Z",
} as const;

describe("GitHub portfolio catalog", () => {
	let closeDatabase: (() => Promise<void>) | undefined;

	afterEach(async () => {
		await closeDatabase?.();
		closeDatabase = undefined;
	});

	it("normalizes safe public metadata and rejects private or credential-bearing URLs", async () => {
		const repository = toDiscoveredRepository(sourceRepository);

		expect(repository).toMatchObject({
			githubRepositoryId: "123456789",
			owner: "devUgur",
			name: "portfolio-demo",
			visibility: "public",
			description: "A public demo repository.",
			homepageUrl: "https://example.com/",
			topics: ["next.js", "portfolio"],
		});

		const privateRepository = toDiscoveredRepository({
			...sourceRepository,
			visibility: "private",
			private: true,
		});
		expect(privateRepository).toBeNull();

		const unsafeHomepage = toDiscoveredRepository({
			...sourceRepository,
			homepage: "https://example.com/?token=do-not-store",
		});
		expect(unsafeHomepage?.homepageUrl).toBeNull();
	});

	it("does not pass database or GitHub token variables to the GitHub CLI", () => {
		expect(githubCliEnvironment({
			PATH: "C:/tools",
			APPDATA: "C:/Users/test/AppData/Roaming",
			DATABASE_URL: "postgres://secret",
			GH_TOKEN: "secret-token",
			INFISICAL_TOKEN: "secret-token",
		})).toEqual({
			PATH: "C:/tools",
			APPDATA: "C:/Users/test/AppData/Roaming",
		});
	});

	it("keeps README inspection bounded and removes code and markup before showing evidence", () => {
		const excerpt = readmeExcerpt("# Demo\n\nA public project. [Docs](https://example.com)\n\n```sh\necho secret\n```\n\n<!-- hidden -->\u001b[31mterminal control\u001b[0m");
		expect(excerpt).toContain("Demo A public project. Docs");
		expect(excerpt).not.toContain("echo secret");
		expect(excerpt).not.toContain("hidden");
		expect(excerpt).not.toContain("\u001b");
		expect(readmeExcerpt("a".repeat(2000))).toHaveLength(1200);
	});

	it("upserts by immutable GitHub ID and preserves the original discovery timestamp", async () => {
		const { server, close } = await useTestDatabase();
		closeDatabase = close;
		const first = toDiscoveredRepository(sourceRepository);
		expect(first).not.toBeNull();
		await syncPublicGitHubRepositories([first!]);

		const [initial] = await server.getDb().select().from(server.schema.portfolioGithubRepositories);
		const renamed = { ...first!, owner: "newOwner", name: "renamed-demo", description: "Updated description" };
		await syncPublicGitHubRepositories([renamed]);
		const records = await server.getDb().select().from(server.schema.portfolioGithubRepositories);

		expect(records).toHaveLength(1);
		expect(records[0]).toMatchObject({
			id: initial!.id,
			githubRepositoryId: "123456789",
			owner: "newOwner",
			name: "renamed-demo",
			description: "Updated description",
		});
		expect(records[0]!.discoveredAt.toISOString()).toBe(initial!.discoveredAt.toISOString());
	});
});
