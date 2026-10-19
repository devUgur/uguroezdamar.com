import { run } from "../lib/exec.ts";
import { accessHint, withSecrets } from "../lib/infisical.ts";
import type { Stage } from "../lib/stages.ts";

const serverDiscovery = ["pnpm", "--filter", "@ugur/server", "projects:discover"];

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
