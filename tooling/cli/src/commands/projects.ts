import { run } from "../lib/exec.ts";
import { accessHint, withSecrets } from "../lib/infisical.ts";
import type { Stage } from "../lib/stages.ts";

const serverDiscovery = ["pnpm", "--filter", "@ugur/server", "projects:discover"];
const serverInspection = ["pnpm", "--filter", "@ugur/server", "projects:inspect"];

/** Inspect a single owner repository using public metadata and a bounded README excerpt; no persistence. */
export function inspectProject(repository: string): number {
	const match = /^([A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?)\/([A-Za-z0-9._-]{1,100})$/.exec(repository);
	if (!match || match[2] === "." || match[2] === "..") {
		console.error("Use `pnpm ugur projects inspect <owner>/<repo>` with a valid repository name.");
		return 1;
	}
	return run(serverInspection[0]!, [...serverInspection.slice(1), match[1]!, match[2]!]).code;
}

/** GitHub discovery is read-only by default; applying may write only to the dev catalog. */
export function discoverProjects(apply: boolean, stage: Stage): number {
	if (!apply) return run(serverDiscovery[0]!, serverDiscovery.slice(1)).code;
	if (stage !== "dev") {
		console.error("Project discovery can only write to Neon dev. Production catalog sync is not available.");
		return 1;
	}

	const invocation = withSecrets("dev", [...serverDiscovery, "--", "--apply"]);
	if (!invocation) {
		console.error(accessHint());
		return 1;
	}
	return run(invocation[0]!, invocation[1]!).code;
}
