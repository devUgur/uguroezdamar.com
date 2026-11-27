import type { Env } from "../env.ts";
import type { ActorStatePort } from "../platform/ports.ts";
import { emit } from "../events.ts";
import { githubToken } from "../github/credentials.ts";
import { chunkMarkdown, isKnowledgeFile } from "./chunk.ts";
import { embedPending, removeSource, replaceSource } from "./store.ts";

/**
 * Builds and refreshes the knowledge index of one project (plan stage 3). One object per tenant and project; work
 * runs in alarm stages of FILES_PER_STAGE files, because each invocation may only make a limited number of external
 * calls. Unchanged files (same blob sha) are skipped, removed files leave the index.
 */
const FILES_PER_STAGE = 15;
const MAX_FILES = 400;
const GITHUB = "https://api.github.com";

export interface IndexJob {
  tenantId: string;
  projectId: string;
  repo: string;
  ref: string;
  status: "queued" | "running" | "done" | "failed";
  queue: { path: string; sha: string }[];
  remove: string[];
  indexed: number;
  skipped: number;
  vectorsMissing: boolean;
  startedAt: number;
  finishedAt?: number;
  error?: string;
}

const JOB = "job";

/** Indexes one project in alarm stages. Hosted by a Durable Object on Cloudflare (cloudflare/indexer-object.ts). */
export class KnowledgeIndexerCore {
  constructor(
    private readonly state: ActorStatePort,
    private readonly env: Env,
  ) {}

  async start(input: { tenantId: string; projectId: string; repo: string; ref: string }): Promise<IndexJob> {
    const current = await this.state.get<IndexJob>(JOB);
    if (current && (current.status === "queued" || current.status === "running") && Date.now() - current.startedAt < 15 * 60_000) return current;
    const job: IndexJob = { ...input, status: "queued", queue: [], remove: [], indexed: 0, skipped: 0, vectorsMissing: false, startedAt: Date.now() };
    await this.state.put(JOB, job);
    await this.state.setAlarm(Date.now());
    return job;
  }

  async status(): Promise<IndexJob | null> {
    return (await this.state.get<IndexJob>(JOB)) ?? null;
  }

  async alarm(): Promise<void> {
    const job = await this.state.get<IndexJob>(JOB);
    if (!job || job.status === "done" || job.status === "failed") return;
    try {
      if (job.status === "queued") await this.plan(job);
      const batch = job.queue.splice(0, FILES_PER_STAGE);
      for (const file of batch) {
        const text = await this.github<string>(job, `/repos/${job.repo}/contents/${encodeURI(file.path)}?ref=${encodeURIComponent(job.ref)}`, "application/vnd.github.raw");
        const chunks = chunkMarkdown(text, file.path);
        const result = await replaceSource(this.env, job.tenantId, job.projectId, `file:${file.path}`, file.sha, chunks);
        job.indexed += 1;
        if (!result.embedded && chunks.length) job.vectorsMissing = true;
      }
      if (job.queue.length) {
        await this.state.put(JOB, job);
        await this.state.setAlarm(Date.now() + 100);
        return;
      }
      for (const source of job.remove) await removeSource(this.env, job.tenantId, job.projectId, source);
      await this.indexTasks(job);
      // Chunks from earlier runs whose embedding failed get their vectors now, if Workers AI answers again.
      try {
        while ((await embedPending(this.env, job.tenantId, job.projectId)) > 0);
        job.vectorsMissing = false;
      } catch {
        job.vectorsMissing = true;
      }
      job.status = "done";
      job.finishedAt = Date.now();
      await this.state.put(JOB, job);
      await emit(this.env, { tenantId: job.tenantId, projectId: job.projectId, type: "knowledge_indexed", data: { indexed: job.indexed, skipped: job.skipped, removed: job.remove.length, vectorsMissing: job.vectorsMissing } });
    } catch (error) {
      job.status = "failed";
      job.error = error instanceof Error ? error.message.slice(0, 500) : String(error);
      job.finishedAt = Date.now();
      await this.state.put(JOB, job);
      await emit(this.env, { tenantId: job.tenantId, projectId: job.projectId, type: "knowledge_indexed", data: { error: job.error } }).catch(() => undefined);
    }
  }

  /** Lists the repository once and queues every documentation file whose content changed since the last run. */
  private async plan(job: IndexJob): Promise<void> {
    job.status = "running";
    const tree = await this.github<{ tree: { path: string; type: string; sha: string; size?: number }[]; truncated: boolean }>(
      job,
      `/repos/${job.repo}/git/trees/${encodeURIComponent(job.ref)}?recursive=1`,
    );
    const files = tree.tree.filter((entry) => entry.type === "blob" && isKnowledgeFile(entry.path, entry.size ?? 0)).slice(0, MAX_FILES);
    const { results } = await this.env.DB.prepare("SELECT source, version FROM knowledge_sources WHERE tenant_id = ? AND project_id = ? AND source LIKE 'file:%'")
      .bind(job.tenantId, job.projectId)
      .all<{ source: string; version: string }>();
    const known = new Map(results.map((row) => [row.source, row.version]));
    job.queue = files.filter((file) => known.get(`file:${file.path}`) !== file.sha).map((file) => ({ path: file.path, sha: file.sha }));
    job.skipped = files.length - job.queue.length;
    const present = new Set(files.map((file) => `file:${file.path}`));
    job.remove = [...known.keys()].filter((source) => !present.has(source));
  }

  /** Finished tasks carry decisions and results: title, description, criteria and the owner's completion note. */
  private async indexTasks(job: IndexJob): Promise<void> {
    const [{ results: tasks }, { results: known }] = await Promise.all([
      this.env.DB.prepare(
        "SELECT id, title, description, acceptance_criteria, completion_note, updated_at FROM tasks WHERE tenant_id = ? AND project_id = ? AND status = 'done' ORDER BY updated_at DESC LIMIT 100",
      )
        .bind(job.tenantId, job.projectId)
        .all<{ id: string; title: string; description: string | null; acceptance_criteria: string | null; completion_note: string | null; updated_at: number }>(),
      this.env.DB.prepare("SELECT source, version FROM knowledge_sources WHERE tenant_id = ? AND project_id = ? AND source LIKE 'task:%'")
        .bind(job.tenantId, job.projectId)
        .all<{ source: string; version: string }>(),
    ]);
    const versions = new Map(known.map((row) => [row.source, row.version]));
    for (const task of tasks) {
      const source = `task:${task.id}`;
      if (versions.get(source) === String(task.updated_at)) continue;
      const text = [task.description, task.acceptance_criteria ? `Abnahmekriterien:\n${task.acceptance_criteria}` : "", task.completion_note ? `Abschluss:\n${task.completion_note}` : ""].filter(Boolean).join("\n\n");
      await replaceSource(this.env, job.tenantId, job.projectId, source, String(task.updated_at), [{ heading: `Erledigte Aufgabe: ${task.title}`, text: text || task.title }]);
    }
  }

  private async github<T>(job: IndexJob, path: string, accept = "application/vnd.github+json"): Promise<T> {
    const token = await githubToken(this.env, job.tenantId, job.repo.split("/")[0] ?? "");
    const response = await fetch(`${GITHUB}${path}`, {
      headers: { accept, authorization: `Bearer ${token}`, "user-agent": "uguroezdamar-api", "x-github-api-version": "2022-11-28" },
    });
    if (!response.ok) throw new Error(`GitHub ${response.status}: ${(await response.text()).slice(0, 300)}`);
    return (accept.endsWith("raw") ? await response.text() : await response.json()) as T;
  }
}
