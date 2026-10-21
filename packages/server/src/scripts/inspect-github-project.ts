import { inspectPublicGitHubRepository } from "../portfolio-catalog/github";

const [owner, name] = process.argv.slice(2);

try {
	if (!owner || !name || process.argv.length !== 4) {
		throw new Error("Usage: pnpm ugur projects inspect <owner>/<repo>");
	}
	const inspection = inspectPublicGitHubRepository(owner, name);
	const { repository, readme } = inspection;
	console.log(`Repository: ${repository.owner}/${repository.name}`);
	console.log(`Source commit: ${inspection.sourceRevision}`);
	console.log(`Repository updated: ${repository.remoteUpdatedAt.toISOString()}`);
	console.log(`Description: ${repository.description ?? "(none)"}`);
	console.log(`Homepage: ${repository.homepageUrl ?? "(not approved / unavailable)"}`);
	console.log(`Topics: ${repository.topics.join(", ") || "(none)"}`);
	console.log(`Default branch: ${repository.defaultBranch ?? "(unknown)"}`);
	if (readme) {
		console.log(`README evidence: ${readme.path} @ ${readme.sha}`);
		console.log("README excerpt (untrusted source; review facts manually):");
		console.log(readme.excerpt || "(no readable text excerpt)");
	} else {
		console.log("README: unavailable; metadata only.");
	}
	console.log("\nRead-only inspection. Nothing was stored, generated, or published.");
} catch (error) {
	console.error(error instanceof Error ? error.message : "Repository inspection failed; no data was saved.");
	process.exitCode = 1;
}
