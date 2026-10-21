import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { REPO_ROOT, run } from "../lib/exec.ts";
import { renderProjectDraft, type ProjectDraftSource } from "../lib/project-drafts.ts";
import { accessHint, withSecrets } from "../lib/infisical.ts";
import type { Stage } from "../lib/stages.ts";

const serverDiscovery = ["pnpm", "--filter", "@ugur/server", "projects:discover"];
const serverInspection = ["pnpm", "--filter", "@ugur/server", "projects:inspect"];

function validInspection(value: unknown): value is ProjectDraftSource {
	if (!value || typeof value !== "object") return false;
	const inspection = value as Record<string, unknown>;
	const repository = inspection.repository as Record<string, unknown> | null;
	if (!repository || typeof repository.owner !== "string" || typeof repository.name !== "string") return false;
	if (repository.description !== null && typeof repository.description !== "string") return false;
	if (typeof repository.isArchived !== "boolean" || typeof inspection.sourceRevision !== "string" || !/^[a-f0-9]{40}$/i.test(inspection.sourceRevision)) return false;
	if (inspection.readme === null) return true;
	const readme = inspection.readme as Record<string, unknown> | null;
	return Boolean(readme && typeof readme.path === "string" && typeof readme.sha === "string" && /^[a-f0-9]{40}$/i.test(readme.sha));
}

/** Inspect a single owner repository using public metadata and a bounded README excerpt; no persistence. */
export function inspectProject(repository: string): number {
	const match = /^([A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?)\/([A-Za-z0-9._-]{1,100})$/.exec(repository);
	if (!match || match[2] === "." || match[2] === "..") {
		console.error("Use `pnpm ugur projects inspect <owner>/<repo>` with a valid repository name.");
		return 1;
	}
	return run(serverInspection[0]!, [...serverInspection.slice(1), match[1]!, match[2]!]).code;
}

/** Dry-run by default. --apply writes one schema-valid local draft and refuses to overwrite. */
export function draftProject(repository: string, slug: string, apply: boolean): number {
	const match = /^([A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?)\/([A-Za-z0-9._-]{1,100})$/.exec(repository);
	if (!match || match[2] === "." || match[2] === ".." || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
		console.error("Use `pnpm ugur projects draft <owner>/<repo> --slug <lowercase-slug> [--apply]`.");
		return 1;
	}
	const result = run("pnpm", [...serverInspection, match[1]!, match[2]!, "--json"], { capture: true });
	if (result.code !== 0) {
		console.error(result.stderr.trim() || "Repository inspection failed; no draft was written.");
		return result.code;
	}
	let inspection: unknown;
	try {
		const outputLine = result.stdout.trim().split(/\r?\n/).at(-1);
		inspection = JSON.parse(outputLine ?? "");
	} catch {
		console.error("GitHub inspection returned unreadable data; no draft was written.");
		return 1;
	}
	if (!validInspection(inspection)) {
		console.error("GitHub inspection did not match the expected safe shape; no draft was written.");
		return 1;
	}

	const target = join(REPO_ROOT, "apps", "site", "content", "projects", `${slug}.mdx`);
	const content = renderProjectDraft(inspection);
	if (!apply) {
		console.log(`Dry run: would write ${target}\nNo file was changed. Re-run with --apply to create this local draft.\n\n${content}`);
		return 0;
	}
	try {
		writeFileSync(target, content, { encoding: "utf8", flag: "wx" });
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === "EEXIST") {
			console.error(`Draft already exists at ${target}; no file was changed.`);
			return 1;
		}
		console.error("Could not write the draft; no existing file was overwritten.");
		return 1;
	}
	console.log(`Created local draft: ${target}\nIt remains draft: true and is not published.`);
	return 0;
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
