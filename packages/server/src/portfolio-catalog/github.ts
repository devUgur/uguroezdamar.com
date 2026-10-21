import "server-only";

import { spawnSync } from "node:child_process";
import { sql } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "../db/client";
import { portfolioGithubRepositories } from "../db/schema";

const RepositorySchema = z.object({
	id: z.number().int().positive().safe(),
	name: z.string().min(1).max(100),
	owner: z.object({ login: z.string().min(1).max(39) }),
	visibility: z.enum(["public", "private"]),
	private: z.boolean(),
	description: z.string().nullable(),
	homepage: z.string().nullable(),
	topics: z.array(z.string()).max(100),
	default_branch: z.string().nullable(),
	fork: z.boolean(),
	archived: z.boolean(),
	updated_at: z.iso.datetime(),
});

const GitHubPageSchema = z.array(RepositorySchema);
const CommitPageSchema = z.array(z.object({ sha: z.string().regex(/^[a-f0-9]{40}$/i) }));
const ReadmeSchema = z.object({
	name: z.string().max(255),
	path: z.string().max(1024),
	sha: z.string().regex(/^[a-f0-9]{40}$/i),
	encoding: z.literal("base64"),
	content: z.string().max(1_500_000),
});

const GITHUB_CLI_ENVIRONMENT_KEYS = new Set([
	"PATH", "PATHEXT", "SYSTEMROOT", "WINDIR", "USERPROFILE", "HOMEDRIVE", "HOMEPATH",
	"APPDATA", "LOCALAPPDATA", "HOME", "XDG_CONFIG_HOME", "GH_CONFIG_DIR", "TMP", "TEMP",
]);

export type DiscoveredGitHubRepository = {
	githubRepositoryId: string;
	owner: string;
	name: string;
	visibility: "public";
	description: string | null;
	homepageUrl: string | null;
	topics: string[];
	defaultBranch: string | null;
	isFork: boolean;
	isArchived: boolean;
	remoteUpdatedAt: Date;
};

export type GitHubRepositoryInspection = {
	repository: DiscoveredGitHubRepository;
	readme: { path: string; sha: string; excerpt: string } | null;
	sourceRevision: string;
};

function runGitHubApi(endpoint: string): string {
	const result = spawnSync("gh", ["api", endpoint], {
		encoding: "utf8",
		maxBuffer: 2 * 1024 * 1024,
		windowsHide: true,
		env: githubCliEnvironment(),
	});
	if (result.error || result.status !== 0) {
		throw new Error("Could not read the selected public GitHub repository. Confirm its owner/name and `gh auth status`.");
	}
	return result.stdout;
}

export function readmeExcerpt(markdown: string): string {
	return markdown
		.replace(/```[\s\S]*?```|~~~[\s\S]*?~~~/g, " ")
		.replace(/<!--[\s\S]*?-->/g, " ")
		.replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
		.replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
		.replace(/^\s{0,3}#{1,6}\s*/gm, "")
		.replace(/[`*_>~]/g, " ")
		.replace(/<[^>]*>/g, " ")
		.replace(/[\u0000-\u001f\u007f-\u009f]/g, " ")
		.replace(/\s+/g, " ")
		.trim()
		.slice(0, 1200);
}

export function parseLatestCommitSha(value: unknown): string | null {
	const parsed = CommitPageSchema.safeParse(value);
	return parsed.success ? parsed.data[0]?.sha ?? null : null;
}

/** Inspect one explicit repository. Reads only public metadata and README; never executes or stores repository content. */
export function inspectPublicGitHubRepository(owner: string, name: string): GitHubRepositoryInspection {
	if (!/^[A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?$/.test(owner) || !/^[A-Za-z0-9._-]{1,100}$/.test(name) || name === "." || name === "..") {
		throw new Error("Use a valid public repository in the form <owner>/<repo>.");
	}
	const authenticatedOwner = runGitHubApi("user").trim();
	let parsedOwner: unknown;
	try { parsedOwner = JSON.parse(authenticatedOwner); } catch {
		throw new Error("Could not verify the authenticated GitHub account; no data was saved.");
	}
	const account = z.object({ login: z.string().min(1).max(39) }).safeParse(parsedOwner);
	if (!account.success || account.data.login.toLowerCase() !== owner.toLowerCase()) {
		throw new Error("Inspection is limited to repositories owned by the authenticated GitHub account.");
	}
	const rawRepository = runGitHubApi(`repos/${owner}/${name}`);
	let parsedRepository: unknown;
	try { parsedRepository = JSON.parse(rawRepository); } catch {
		throw new Error("GitHub returned unreadable repository metadata; no data was saved.");
	}
	const safeRepository = RepositorySchema.safeParse(parsedRepository);
	if (!safeRepository.success) throw new Error("GitHub repository metadata did not match the expected schema; no data was saved.");
	const repository = toDiscoveredRepository(safeRepository.data);
	if (!repository) throw new Error("The selected repository is private; inspection supports public repositories only.");
	let commitResponse: unknown;
	try { commitResponse = JSON.parse(runGitHubApi(`repos/${owner}/${name}/commits?per_page=1`)); } catch {
		throw new Error("Could not read the default branch revision; no data was saved.");
	}
	const sourceRevision = parseLatestCommitSha(commitResponse);
	if (!sourceRevision) throw new Error("The repository has no readable default branch commit; no data was saved.");

	let readme: GitHubRepositoryInspection["readme"] = null;
	try {
		const rawReadme = runGitHubApi(`repos/${owner}/${name}/readme`);
		const parsedReadme = ReadmeSchema.safeParse(JSON.parse(rawReadme));
		if (parsedReadme.success) {
			const markdown = Buffer.from(parsedReadme.data.content, "base64").toString("utf8");
			readme = { path: parsedReadme.data.path, sha: parsedReadme.data.sha, excerpt: readmeExcerpt(markdown) };
		}
	} catch {
		// A missing or unreadable README is non-fatal; metadata inspection remains useful.
	}

	return { repository, readme, sourceRevision };
}

function safeHomepage(value: string | null): string | null {
	if (!value) return null;
	try {
		const url = new URL(value);
		if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash) return null;
		return url.toString();
	} catch {
		return null;
	}
}

/** Keep Neon/Infisical credentials out of the GitHub CLI subprocess environment. */
export function githubCliEnvironment(source: NodeJS.ProcessEnv = process.env): NodeJS.ProcessEnv {
	return Object.fromEntries(
		Object.entries(source).filter(([key]) => GITHUB_CLI_ENVIRONMENT_KEYS.has(key.toUpperCase())),
	);
}

export function toDiscoveredRepository(value: z.infer<typeof RepositorySchema>): DiscoveredGitHubRepository | null {
	// Keep the policy enforced in code even if the API query changes or returns unexpected data.
	if (value.private || value.visibility !== "public") return null;
	return {
		githubRepositoryId: String(value.id),
		owner: value.owner.login,
		name: value.name,
		visibility: "public",
		description: value.description?.trim().slice(0, 1000) || null,
		homepageUrl: safeHomepage(value.homepage),
		topics: [...new Set(value.topics.map((topic) => topic.trim().toLowerCase()).filter(Boolean))].slice(0, 20),
		defaultBranch: value.default_branch?.slice(0, 255) ?? null,
		isFork: value.fork,
		isArchived: value.archived,
		remoteUpdatedAt: new Date(value.updated_at),
	};
}

/**
 * Reads only public repositories owned by the authenticated `gh` user. No GitHub response body
 * or credential is logged, persisted, or returned beyond the allowlisted metadata fields.
 */
export function discoverPublicGitHubRepositories(): DiscoveredGitHubRepository[] {
	const result = spawnSync(
		"gh",
		["api", "--paginate", "--slurp", "user/repos?visibility=public&affiliation=owner&per_page=100"],
		{ encoding: "utf8", maxBuffer: 16 * 1024 * 1024, windowsHide: true, env: githubCliEnvironment() },
	);
	if (result.error || result.status !== 0) {
		throw new Error("Could not read GitHub repositories. Confirm that `gh auth status` succeeds and retry after any API rate limit.");
	}

	let json: unknown;
	try {
		json = JSON.parse(result.stdout);
	} catch {
		throw new Error("GitHub returned an unreadable repository response; no data was saved.");
	}
	const pages = z.array(GitHubPageSchema).safeParse(json);
	if (!pages.success) throw new Error("GitHub repository response did not match the expected schema; no data was saved.");

	const byId = new Map<string, DiscoveredGitHubRepository>();
	for (const page of pages.data) {
		for (const item of page) {
			const repository = toDiscoveredRepository(item);
			if (repository) byId.set(repository.githubRepositoryId, repository);
		}
	}
	return [...byId.values()].sort((a, b) => a.owner.localeCompare(b.owner) || a.name.localeCompare(b.name));
}

/** Idempotent source-metadata upsert. Missing repositories are never deleted or archived here. */
export async function syncPublicGitHubRepositories(repositories: DiscoveredGitHubRepository[]): Promise<number> {
	if (repositories.length === 0) return 0;
	const now = new Date();
	const db = getDb();
	await db
		.insert(portfolioGithubRepositories)
		.values(repositories.map((repository) => ({ ...repository, syncedAt: now })))
		.onConflictDoUpdate({
			target: portfolioGithubRepositories.githubRepositoryId,
			set: {
				owner: sql`excluded.owner`,
				name: sql`excluded.name`,
				visibility: sql`excluded.visibility`,
				description: sql`excluded.description`,
				homepageUrl: sql`excluded.homepage_url`,
				topics: sql`excluded.topics`,
				defaultBranch: sql`excluded.default_branch`,
				isFork: sql`excluded.is_fork`,
				isArchived: sql`excluded.is_archived`,
				remoteUpdatedAt: sql`excluded.remote_updated_at`,
				syncedAt: now,
			},
		});
	return repositories.length;
}
