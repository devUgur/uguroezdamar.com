import { discoverPublicGitHubRepositories, syncPublicGitHubRepositories } from "../portfolio-catalog/github";

const apply = process.argv.includes("--apply");

try {
	const repositories = discoverPublicGitHubRepositories();
	console.log(`Found ${repositories.length} public repositories owned by the authenticated GitHub account.`);
	for (const repository of repositories) {
		const labels = [repository.isArchived ? "archived" : null, repository.isFork ? "fork" : null].filter(Boolean);
		console.log(`  ${repository.owner}/${repository.name}${labels.length ? ` (${labels.join(", ")})` : ""}`);
	}

	if (!apply) {
		console.log("\nDry run. No database was read or changed. Re-run with --apply to sync metadata to Neon dev.");
	} else {
		const synced = await syncPublicGitHubRepositories(repositories);
		console.log(`\nSynchronized ${synced} public repository records to the dev catalog. Missing repositories were left untouched.`);
	}
} catch (error) {
	console.error(error instanceof Error ? error.message : "GitHub repository discovery failed; no data was saved.");
	process.exitCode = 1;
}
