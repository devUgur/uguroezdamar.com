import { describe, expect, it } from "vitest";

import { parseFrontmatter } from "../apps/site/src/content/mdx";
import { renderProjectDraft } from "../tooling/cli/src/lib/project-drafts";

describe("GitHub project draft generation", () => {
	it("creates a schema-valid non-featured draft with pinned provenance and no README text", async () => {
		const generated = renderProjectDraft(
			{
				repository: {
					owner: "devUgur",
					name: "portfolio-demo",
					description: "A public project.",
				},
				sourceRevision: "a".repeat(40),
				readme: { path: "README.md", sha: "b".repeat(40) },
			},
			new Date("2026-10-21T10:15:00.000Z"),
		);
		const parsed = parseFrontmatter(generated);
		const content = await import("../apps/site/src/content/projects");
		const project = content.parseProject("portfolio-demo", parsed.data, parsed.content);

		expect(project).toMatchObject({
			title: "portfolio-demo",
			summary: "A public project.",
			featured: false,
			draft: true,
			technologies: [],
			repositoryVisibility: "public",
			source: {
				provider: "github",
				repository: "devUgur/portfolio-demo",
				commit: "a".repeat(40),
				readme: { path: "README.md", sha: "b".repeat(40) },
				importedAt: "2026-10-21T10:15:00.000Z",
			},
		});
		expect(generated).not.toContain("A public project.\nrole:");
		expect(generated).not.toContain("README excerpt");
	});

	it("escapes hostile metadata as one scalar and uses a placeholder when description is absent", () => {
		const generated = renderProjectDraft({
			repository: { owner: "devUgur", name: "unclassified-tool", description: 'Title\nrole: "Owner"\n{danger}' },
			sourceRevision: "c".repeat(40),
			readme: null,
		});
		const parsed = parseFrontmatter(generated);
		expect(parsed.data.summary).toBe('Title\nrole: "Owner"\n{danger}');
		expect(parsed.data.role).toBeUndefined();
		expect(parsed.data.status).toBeUndefined();

		const emptyDescription = renderProjectDraft({
			repository: { owner: "devUgur", name: "no-description", description: null },
			sourceRevision: "d".repeat(40),
			readme: null,
		});
		expect(parseFrontmatter(emptyDescription).data.summary).toBe(
			"Draft for devUgur/no-description; add an owner-verified summary.",
		);
	});
});
