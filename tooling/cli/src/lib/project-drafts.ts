export type ProjectDraftSource = {
	repository: { owner: string; name: string; description: string | null };
	sourceRevision: string;
	readme: { path: string; sha: string } | null;
};

/** Create a schema-valid, unpublished MDX stub using GitHub metadata only; README text is evidence, never copied. */
export function renderProjectDraft(source: ProjectDraftSource, importedAt = new Date()): string {
	const { repository } = source;
	const title = repository.name;
	const summary = repository.description?.trim() || `Draft for ${repository.owner}/${repository.name}; add an owner-verified summary.`;
	const githubUrl = `https://github.com/${repository.owner}/${repository.name}`;
	const frontmatter = [
		`title: ${JSON.stringify(title)}`,
		`summary: ${JSON.stringify(summary)}`,
		`featured: false`,
		`displayOrder: 100`,
		`draft: true`,
		`technologies: []`,
		`links:`,
		`  github: ${JSON.stringify(githubUrl)}`,
		`repositoryVisibility: public`,
		`source:`,
		`  provider: github`,
		`  repository: ${JSON.stringify(`${repository.owner}/${repository.name}`)}`,
		`  commit: ${JSON.stringify(source.sourceRevision)}`,
		`  readme: ${source.readme ? `{ path: ${JSON.stringify(source.readme.path)}, sha: ${JSON.stringify(source.readme.sha)} }` : "null"}`,
		`  importedAt: ${JSON.stringify(importedAt.toISOString())}`,
		`updatedAt: ${importedAt.toISOString().slice(0, 10)}`,
	].join("\n");

	return `---\n${frontmatter}\n---\n\n## Editorial review required\n\nThis draft was generated from public GitHub repository metadata. README text was not copied.\n\n- Confirm the project title, description, category, and current status.\n- Add the owner's role, contributions, timeframe, verified technologies, and approved outcome.\n- Confirm the repository link and any rights or client permissions before publication.\n- Add an approved cover image and descriptive alt text, or leave the cover unset.\n- Keep this file as a draft until every public claim is reviewed.\n`;
}
