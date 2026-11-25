import type { Tool, ToolContext } from "./port.ts";
import { str, ToolInputError } from "./port.ts";

const API = "https://api.github.com";
const MAX_FILE_CHARS = 60_000;
/** Agents only ever write to their own branches; main changes only through a merged pull request. */
const BRANCH_PREFIX = "agent/";

async function gh<T>(context: ToolContext, path: string, init: RequestInit = {}): Promise<T> {
  const token = context.env.AGENT_GITHUB_TOKEN;
  if (!token) throw new Error("AGENT_GITHUB_TOKEN ist nicht gesetzt.");
  const response = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      accept: "application/vnd.github+json",
      authorization: `Bearer ${token}`,
      "user-agent": "uguroezdamar-platform",
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

async function defaultBranch(context: ToolContext): Promise<string> {
  const repo = await gh<{ default_branch: string }>(context, `/repos/${context.repo}`);
  return repo.default_branch;
}

const listFiles: Tool = {
  spec: {
    name: "repo_list_files",
    description:
      "Listet Dateien und Ordner im Repository. Ohne path die oberste Ebene. Mit recursive=true alle Dateien unter path (max. 400).",
    parameters: {
      type: "object",
      properties: {
        path: { type: "string", description: "Ordner relativ zur Wurzel, z. B. apps/site" },
        ref: { type: "string", description: "Branch oder Commit, Standard ist der Hauptbranch" },
        recursive: { type: "boolean" },
      },
    },
  },
  async run(args, context) {
    const path = str(args, "path", "").replace(/^\/+|\/+$/g, "");
    const ref = str(args, "ref", await defaultBranch(context));
    if (args.recursive === true) {
      const tree = await gh<{ tree: { path: string; type: string }[]; truncated: boolean }>(
        context,
        `/repos/${context.repo}/git/trees/${encodeURIComponent(ref)}?recursive=1`,
      );
      const files = tree.tree
        .filter((entry) => entry.type === "blob" && (!path || entry.path.startsWith(`${path}/`)))
        .map((entry) => entry.path);
      return { ref, count: files.length, files: files.slice(0, 400), truncated: files.length > 400 || tree.truncated };
    }
    const entries = await gh<{ name: string; type: string; size: number }[] | { type: string }>(
      context,
      `/repos/${context.repo}/contents/${path}?ref=${encodeURIComponent(ref)}`,
    );
    if (!Array.isArray(entries)) return { ref, note: `${path} ist eine Datei, kein Ordner.` };
    return { ref, entries: entries.map((entry) => `${entry.type === "dir" ? "📁" : "📄"} ${entry.name}`) };
  },
};

const readFile: Tool = {
  spec: {
    name: "repo_read_file",
    description: "Liest eine Textdatei aus dem Repository vollständig (bis 60.000 Zeichen).",
    parameters: {
      type: "object",
      properties: {
        path: { type: "string" },
        ref: { type: "string", description: "Branch oder Commit, Standard ist der Hauptbranch" },
      },
      required: ["path"],
    },
  },
  async run(args, context) {
    const path = str(args, "path").replace(/^\/+/, "");
    const ref = str(args, "ref", await defaultBranch(context));
    const file = await gh<{ content?: string; encoding?: string; size: number; sha: string; type: string }>(
      context,
      `/repos/${context.repo}/contents/${path}?ref=${encodeURIComponent(ref)}`,
    );
    if (file.type !== "file" || file.encoding !== "base64" || file.content === undefined) {
      return { path, note: "Keine lesbare Textdatei (Ordner, zu groß oder binär)." };
    }
    const text = decodeBase64(file.content);
    return {
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
    description: "Sucht Text im Code des Hauptbranches und liefert die Dateipfade der Treffer.",
    parameters: { type: "object", properties: { query: { type: "string" } }, required: ["query"] },
  },
  async run(args, context) {
    const query = `${str(args, "query")} repo:${context.repo}`;
    const result = await gh<{ total_count: number; items: { path: string }[] }>(
      context,
      `/search/code?per_page=30&q=${encodeURIComponent(query)}`,
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
      "Schreibt einen Commit mit einer oder mehreren Dateien auf einen Agenten-Branch (agent/...). Der Branch wird bei Bedarf vom Hauptbranch angelegt. Jede Datei bekommt ihren VOLLSTÄNDIGEN neuen Inhalt. Braucht Ugurs Freigabe.",
    parameters: {
      type: "object",
      properties: {
        branch: { type: "string", description: "z. B. agent/fix-footer-link" },
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
    const branch = str(args, "branch");
    if (!branch.startsWith(BRANCH_PREFIX)) throw new ToolInputError(`Branch muss mit "${BRANCH_PREFIX}" beginnen.`);
    const message = str(args, "message");
    const files = (Array.isArray(args.files) ? args.files : []) as FileChange[];
    if (!files.length) throw new ToolInputError("Keine Dateien angegeben.");

    const base = await defaultBranch(context);
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
      "Öffnet einen Pull Request von einem Agenten-Branch in den Hauptbranch. Kein Merge, kein Deploy. Braucht Ugurs Freigabe.",
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
    const branch = str(args, "branch");
    if (!branch.startsWith(BRANCH_PREFIX)) throw new ToolInputError(`Branch muss mit "${BRANCH_PREFIX}" beginnen.`);
    const pull = await gh<{ number: number; html_url: string }>(context, `/repos/${context.repo}/pulls`, {
      method: "POST",
      body: JSON.stringify({
        head: branch,
        base: await defaultBranch(context),
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
    parameters: { type: "object", properties: { state: { type: "string", enum: ["open", "closed", "all"] } } },
  },
  async run(args, context) {
    const state = str(args, "state", "open");
    const pulls = await gh<{ number: number; title: string; head: { ref: string }; html_url: string; draft: boolean }[]>(
      context,
      `/repos/${context.repo}/pulls?state=${state}&per_page=30`,
    );
    return pulls.map((pull) => ({ number: pull.number, title: pull.title, branch: pull.head.ref, url: pull.html_url }));
  },
};

const checkStatus: Tool = {
  spec: {
    name: "repo_check_status",
    description: "Zeigt den CI-Status (GitHub Checks) eines Branches oder Commits.",
    parameters: { type: "object", properties: { ref: { type: "string" } }, required: ["ref"] },
  },
  async run(args, context) {
    const ref = str(args, "ref");
    const checks = await gh<{ check_runs: { name: string; status: string; conclusion: string | null; html_url: string }[] }>(
      context,
      `/repos/${context.repo}/commits/${encodeURIComponent(ref)}/check-runs?per_page=50`,
    );
    return checks.check_runs.map((run) => ({ name: run.name, status: run.status, conclusion: run.conclusion, url: run.html_url }));
  },
};

export const githubTools: Tool[] = [
  listFiles,
  readFile,
  searchCode,
  commitFiles,
  openPullRequest,
  listPullRequests,
  checkStatus,
];
