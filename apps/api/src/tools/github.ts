import type { Tool, ToolContext } from "./port.ts";
import { githubToken } from "../github/credentials.ts";
import { allowedOwners } from "../projects/repositories.ts";
import { str, ToolInputError } from "./port.ts";

const API = "https://api.github.com";
const MAX_FILE_CHARS = 60_000;
/**
 * Everyone works on dev (it deploys to the dev environment); main changes only through a pull request
 * from dev. Agents may commit to dev or to their own agent/... branches, always after approval.
 */
export const WORK_BRANCH = "dev";
export const BRANCH_PREFIX = "agent/";

type WriteMode = "dev-first" | "pr-only";

/** How agents may write to the repository of a project: set per project (migration 0009). */
interface RepoPolicy {
  defaultBranch: string;
  /** dev-first: commits on dev, release by pull request dev -> default branch. pr-only: agent/... branches and pull requests only. */
  writeMode: WriteMode;
}

const policies = new WeakMap<ToolContext, Promise<RepoPolicy>>();

/** The registered project's rules for this repository; an unregistered repository gets the strictest ones. */
function policyOf(context: ToolContext): Promise<RepoPolicy> {
  let policy = policies.get(context);
  if (!policy) {
    policy = context.env.DB.prepare("SELECT default_branch, write_mode FROM projects WHERE tenant_id = ? AND repo = ? AND status = 'active'")
      .bind(context.tenantId, context.repo)
      .first<{ default_branch: string; write_mode: string }>()
      .then((row) => ({ defaultBranch: row?.default_branch ?? "main", writeMode: row?.write_mode === "dev-first" ? "dev-first" : "pr-only" }));
    policies.set(context, policy);
  }
  return policy;
}

/** Branch that reading and new agent branches start from: dev in dev-first projects, otherwise the default branch. */
const baseBranch = (policy: RepoPolicy): string => (policy.writeMode === "dev-first" ? WORK_BRANCH : policy.defaultBranch);

async function readRef(context: ToolContext): Promise<string> {
  return baseBranch(await policyOf(context));
}

/** Where a pull request from `branch` goes: dev-first releases dev into the default branch, everything else lands on dev. */
function pullBase(policy: RepoPolicy, branch: string): string {
  return policy.writeMode === "dev-first" && branch !== WORK_BRANCH ? WORK_BRANCH : policy.defaultBranch;
}

function assertWritableBranch(branch: string, policy: RepoPolicy): void {
  const allowed = branch.startsWith(BRANCH_PREFIX) || (policy.writeMode === "dev-first" && branch === WORK_BRANCH);
  if (allowed) return;
  throw new ToolInputError(
    policy.writeMode === "dev-first"
      ? `Schreiben nur auf "${WORK_BRANCH}" oder "${BRANCH_PREFIX}…", nie auf ${policy.defaultBranch}.`
      : `In diesem Projekt nur auf Branches "${BRANCH_PREFIX}…" schreiben, nie auf ${policy.defaultBranch}; danach Pull Request öffnen.`,
  );
}

/** The account a GitHub path belongs to (/repos/owner/name/...), which selects the app installation. */
function ownerOfPath(path: string, fallback: string): string {
  return path.match(/^\/repos\/([^/]+)\//)?.[1] ?? fallback.split("/")[0] ?? "";
}

async function gh<T>(context: ToolContext, path: string, init: RequestInit = {}, owner?: string): Promise<T> {
  const token = await githubToken(context.env, owner ?? ownerOfPath(path, context.repo), () => context.budget.take());
  context.budget.take();
  const response = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      accept: "application/vnd.github+json",
      authorization: `Bearer ${token}`,
      "user-agent": "uguroezdamar-api",
      "x-github-api-version": "2022-11-28",
      ...(init.body ? { "content-type": "application/json" } : {}),
      ...init.headers,
    },
  });
  if (response.status === 404) throw new Error(`GitHub: nicht gefunden (${path})`);
  if (!response.ok) throw new Error(`GitHub ${response.status}: ${(await response.text()).slice(0, 400)}`);
  return (await response.json()) as T;
}

function decodeBase64(content: string): string {
  const binary = atob(content.replace(/\n/g, ""));
  return new TextDecoder().decode(Uint8Array.from(binary, (char) => char.charCodeAt(0)));
}

const REPO_FORMAT = /^[A-Za-z0-9._-]{1,100}\/[A-Za-z0-9._-]{1,100}$/;
const repoParam = {
  type: "string",
  description: "owner/name eines anderen Repositories des Kontos; ohne Angabe das Repository dieses Gesprächs. Nur lesend.",
} as const;

interface RepoMeta {
  full_name: string;
  private: boolean;
  default_branch: string;
}

const foreignRepos = new WeakMap<ToolContext, Map<string, Promise<RepoMeta>>>();

/**
 * Which repository a read tool looks at. Reading reaches every repository of an allowed owner, registered
 * or not; writing stays with the registered project of the chat (ADR 0029). Private content is only
 * returned after the thread has been marked private, so only models without evaluation see it.
 */
async function readTarget(args: Record<string, unknown>, context: ToolContext): Promise<{ repo: string; ref: string }> {
  const requested = typeof args.repo === "string" ? args.repo.trim() : "";
  if (!requested || requested.toLowerCase() === context.repo.toLowerCase()) return { repo: context.repo, ref: await readRef(context) };
  if (!REPO_FORMAT.test(requested)) throw new ToolInputError("Repository im Format owner/name angeben.");
  const owner = requested.split("/")[0] ?? "";
  if (!allowedOwners(context.env).includes(owner.toLowerCase())) {
    throw new ToolInputError(`Auf Repositories von „${owner}“ hat dieser Agent keinen Zugriff.`);
  }
  let cache = foreignRepos.get(context);
  if (!cache) foreignRepos.set(context, (cache = new Map()));
  let meta = cache.get(requested.toLowerCase());
  if (!meta) cache.set(requested.toLowerCase(), (meta = gh<RepoMeta>(context, `/repos/${requested}`)));
  const info = await meta;
  if (info.private) await context.markPrivate?.();
  return { repo: info.full_name, ref: info.default_branch };
}

const listFiles: Tool = {
  spec: {
    name: "repo_list_files",
    description:
      "Listet Dateien und Ordner im Repository. Ohne path die oberste Ebene. Mit recursive=true alle Dateien unter path (max. 400).",
    parameters: {
      type: "object",
      properties: {
        repo: repoParam,
        path: { type: "string", description: "Ordner relativ zur Wurzel, z. B. apps/site" },
        ref: { type: "string", description: "Branch oder Commit, Standard ist dev" },
        recursive: { type: "boolean" },
      },
    },
  },
  async run(args, context) {
    const { repo, ref: defaultRef } = await readTarget(args, context);
    const path = str(args, "path", "").replace(/^\/+|\/+$/g, "");
    const ref = str(args, "ref", defaultRef);
    if (args.recursive === true) {
      const tree = await gh<{ tree: { path: string; type: string }[]; truncated: boolean }>(
        context,
        `/repos/${repo}/git/trees/${encodeURIComponent(ref)}?recursive=1`,
      );
      const files = tree.tree
        .filter((entry) => entry.type === "blob" && (!path || entry.path.startsWith(`${path}/`)))
        .map((entry) => entry.path);
      return { repo: repo, ref, count: files.length, files: files.slice(0, 400), truncated: files.length > 400 || tree.truncated };
    }
    const entries = await gh<{ name: string; type: string; size: number }[] | { type: string }>(
      context,
      `/repos/${repo}/contents/${path}?ref=${encodeURIComponent(ref)}`,
    );
    if (!Array.isArray(entries)) return { repo: repo, ref, note: `${path} ist eine Datei, kein Ordner.` };
    return { repo: repo, ref, entries: entries.map((entry) => `${entry.type === "dir" ? "📁" : "📄"} ${entry.name}`) };
  },
};

const readFile: Tool = {
  spec: {
    name: "repo_read_file",
    description: "Liest eine Textdatei aus dem Repository vollständig (bis 60.000 Zeichen).",
    parameters: {
      type: "object",
      properties: {
        repo: repoParam,
        path: { type: "string" },
        ref: { type: "string", description: "Branch oder Commit, Standard ist dev" },
      },
      required: ["path"],
    },
  },
  async run(args, context) {
    const { repo, ref: defaultRef } = await readTarget(args, context);
    const path = str(args, "path").replace(/^\/+/, "");
    const ref = str(args, "ref", defaultRef);
    const file = await gh<{ content?: string; encoding?: string; size: number; sha: string; type: string }>(
      context,
      `/repos/${repo}/contents/${path}?ref=${encodeURIComponent(ref)}`,
    );
    if (file.type !== "file" || file.encoding !== "base64" || file.content === undefined) {
      return { path, note: "Keine lesbare Textdatei (Ordner, zu groß oder binär)." };
    }
    const text = decodeBase64(file.content);
    return {
      repo: repo,
      path,
      ref,
      sha: file.sha,
      truncated: text.length > MAX_FILE_CHARS,
      content: text.slice(0, MAX_FILE_CHARS),
    };
  },
};

const searchCode: Tool = {
  spec: {
    name: "repo_search_code",
    description: "Sucht Text im Code (Index des Default-Branches auf GitHub) und liefert die Dateipfade der Treffer.",
    parameters: { type: "object", properties: { repo: repoParam, query: { type: "string" } }, required: ["query"] },
  },
  async run(args, context) {
    const { repo } = await readTarget(args, context);
    const query = `${str(args, "query")} repo:${repo}`;
    const result = await gh<{ total_count: number; items: { path: string }[] }>(
      context,
      `/search/code?per_page=30&q=${encodeURIComponent(query)}`,
      {},
      repo.split("/")[0],
    );
    return { total: result.total_count, paths: result.items.map((item) => item.path) };
  },
};

interface FileChange {
  path: string;
  content?: string;
  delete?: boolean;
}

const commitFiles: Tool = {
  requiresApproval: true,
  spec: {
    name: "repo_commit_files",
    description:
      "Schreibt einen Commit mit einer oder mehreren Dateien auf dev (Standard, wird danach automatisch in die Dev-Umgebung ausgeliefert) oder auf einen Branch agent/... (wird bei Bedarf von dev angelegt). Nie main. Jede Datei bekommt ihren VOLLSTÄNDIGEN neuen Inhalt. Braucht Ugurs Freigabe.",
    parameters: {
      type: "object",
      properties: {
        branch: { type: "string", description: "dev oder agent/..., z. B. agent/fix-footer-link" },
        message: { type: "string", description: "Commit-Nachricht, Deutsch, im Imperativ" },
        files: {
          type: "array",
          items: {
            type: "object",
            properties: {
              path: { type: "string" },
              content: { type: "string", description: "vollständiger neuer Dateiinhalt" },
              delete: { type: "boolean" },
            },
            required: ["path"],
          },
        },
      },
      required: ["branch", "message", "files"],
    },
  },
  async run(args, context) {
    const policy = await policyOf(context);
    const branch = str(args, "branch", policy.writeMode === "dev-first" ? WORK_BRANCH : undefined);
    assertWritableBranch(branch, policy);
    const message = str(args, "message");
    const files = (Array.isArray(args.files) ? args.files : []) as FileChange[];
    if (!files.length) throw new ToolInputError("Keine Dateien angegeben.");

    const base = baseBranch(policy);
    let headSha: string;
    try {
      headSha = (await gh<{ object: { sha: string } }>(context, `/repos/${context.repo}/git/ref/heads/${branch}`)).object.sha;
    } catch {
      headSha = (await gh<{ object: { sha: string } }>(context, `/repos/${context.repo}/git/ref/heads/${base}`)).object.sha;
      await gh(context, `/repos/${context.repo}/git/refs`, {
        method: "POST",
        body: JSON.stringify({ ref: `refs/heads/${branch}`, sha: headSha }),
      });
    }

    const headCommit = await gh<{ tree: { sha: string } }>(context, `/repos/${context.repo}/git/commits/${headSha}`);
    const tree = await gh<{ sha: string }>(context, `/repos/${context.repo}/git/trees`, {
      method: "POST",
      body: JSON.stringify({
        base_tree: headCommit.tree.sha,
        tree: files.map((file) =>
          file.delete
            ? { path: file.path, mode: "100644", type: "blob", sha: null }
            : { path: file.path, mode: "100644", type: "blob", content: file.content ?? "" },
        ),
      }),
    });
    const commit = await gh<{ sha: string; html_url: string }>(context, `/repos/${context.repo}/git/commits`, {
      method: "POST",
      body: JSON.stringify({ message, tree: tree.sha, parents: [headSha] }),
    });
    await gh(context, `/repos/${context.repo}/git/refs/heads/${branch}`, {
      method: "PATCH",
      body: JSON.stringify({ sha: commit.sha }),
    });
    return { branch, commit: commit.sha, url: commit.html_url, files: files.map((file) => file.path) };
  },
};

const openPullRequest: Tool = {
  requiresApproval: true,
  spec: {
    name: "repo_open_pull_request",
    description:
      "Öffnet einen Pull Request: von agent/... nach dev, oder von dev nach main (Release in Produktion). Kein Merge, kein Deploy. Braucht Ugurs Freigabe.",
    parameters: {
      type: "object",
      properties: {
        branch: { type: "string" },
        title: { type: "string" },
        body: { type: "string", description: "Was geändert wurde, warum, und wie man es prüft" },
      },
      required: ["branch", "title", "body"],
    },
  },
  async run(args, context) {
    const policy = await policyOf(context);
    const branch = str(args, "branch");
    assertWritableBranch(branch, policy);
    const pull = await gh<{ number: number; html_url: string }>(context, `/repos/${context.repo}/pulls`, {
      method: "POST",
      body: JSON.stringify({
        head: branch,
        base: pullBase(policy, branch),
        title: str(args, "title"),
        body: `${str(args, "body")}\n\n---\nErstellt vom ${context.agentId}-Agenten der Plattform.`,
      }),
    });
    return { number: pull.number, url: pull.html_url };
  },
};

const listPullRequests: Tool = {
  spec: {
    name: "repo_list_pull_requests",
    description: "Listet Pull Requests des Repositories mit Status.",
    parameters: { type: "object", properties: { repo: repoParam, state: { type: "string", enum: ["open", "closed", "all"] } } },
  },
  async run(args, context) {
    const { repo } = await readTarget(args, context);
    const state = str(args, "state", "open");
    const pulls = await gh<{ number: number; title: string; head: { ref: string }; html_url: string; draft: boolean }[]>(
      context,
      `/repos/${repo}/pulls?state=${state}&per_page=30`,
    );
    return pulls.map((pull) => ({ number: pull.number, title: pull.title, branch: pull.head.ref, url: pull.html_url }));
  },
};

const readPullRequest: Tool = {
  spec: {
    name: "repo_read_pull_request",
    description: "Liest Metadaten, geänderte Dateien und verfügbare Patch-Diffs eines Pull Requests. Ausschließlich lesend; maximal 20 Dateien und begrenzte Patch-Größe.",
    parameters: { type: "object", properties: { repo: repoParam, number: { type: "integer", description: "Pull-Request-Nummer" } }, required: ["number"] },
  },
  async run(args, context) {
    const { repo } = await readTarget(args, context);
    const number = Number(args.number);
    if (!Number.isInteger(number) || number < 1) throw new ToolInputError("Ungültige Pull-Request-Nummer.");
    const [pull, files] = await Promise.all([
      gh<{ number: number; title: string; body: string | null; state: string; draft: boolean; head: { ref: string; sha: string }; base: { ref: string } }>(context, `/repos/${repo}/pulls/${number}`),
      gh<{ filename: string; status: string; additions: number; deletions: number; patch?: string }[]>(context, `/repos/${repo}/pulls/${number}/files?per_page=21`),
    ]);
    let remainingPatchChars = 30_000;
    const boundedFiles = files.slice(0, 20).map((file) => {
      const sourcePatch = file.patch ?? "Diff nicht verfügbar.";
      const patch = sourcePatch.slice(0, Math.max(0, remainingPatchChars));
      remainingPatchChars -= patch.length;
      return {
        path: file.filename,
        status: file.status,
        additions: file.additions,
        deletions: file.deletions,
        patch,
        patchTruncated: file.patch === undefined || patch.length < sourcePatch.length,
      };
    });
    return {
      number: pull.number,
      title: pull.title,
      body: (pull.body ?? "").slice(0, 6_000),
      state: pull.state,
      draft: pull.draft,
      base: pull.base.ref,
      head: { branch: pull.head.ref, sha: pull.head.sha },
      files: boundedFiles,
      truncated: files.length > 20 || boundedFiles.some((file) => file.patchTruncated),
    };
  },
};

const checkStatus: Tool = {
  spec: {
    name: "repo_check_status",
    description: "Zeigt den CI-Status (GitHub Checks) eines Branches oder Commits.",
    parameters: { type: "object", properties: { repo: repoParam, ref: { type: "string" } }, required: ["ref"] },
  },
  async run(args, context) {
    const { repo } = await readTarget(args, context);
    const ref = str(args, "ref");
    const checks = await gh<{ check_runs: { name: string; status: string; conclusion: string | null; html_url: string }[] }>(
      context,
      `/repos/${repo}/commits/${encodeURIComponent(ref)}/check-runs?per_page=50`,
    );
    return {
      ref,
      checks: checks.check_runs.map((run) => ({ name: run.name, status: run.status, conclusion: run.conclusion, url: run.html_url })),
    };
  },
};

export const githubTools: Tool[] = [
  listFiles,
  readFile,
  searchCode,
  commitFiles,
  openPullRequest,
  listPullRequests,
  readPullRequest,
  checkStatus,
];
