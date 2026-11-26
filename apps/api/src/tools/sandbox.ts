import { emit } from "../events.ts";
import { assertRef, COMMAND_NAMES, DAILY_RUNS_PER_TENANT, INSTANCE_TYPE, isCommand } from "../workstation/commands.ts";
import { WorkstationUnavailable, workstationFor, type WorkstationJob, type WorkstationResult } from "../workstation/port.ts";
import { previewAlias, previewUrl, previewWorkerName, savePreview, versionIdFrom, WRANGLER_CONFIGS } from "../workstation/previews.ts";
import { gh, readTarget, repoMeta } from "./github.ts";
import type { Tool, ToolContext } from "./port.ts";
import { str, ToolInputError } from "./port.ts";

/** Counts the runs of a tenant per UTC day; refuses once the limit of ADR 0036 is reached. */
async function claimRun(context: ToolContext): Promise<void> {
  const key = `workstation:runs:${context.tenantId}:${new Date().toISOString().slice(0, 10)}`;
  const used = Number((await context.env.CONFIG.get(key)) ?? "0");
  if (used >= DAILY_RUNS_PER_TENANT) throw new ToolInputError(`Tageslimit von ${DAILY_RUNS_PER_TENANT} Workstation-Läufen erreicht; morgen wieder.`);
  await context.env.CONFIG.put(key, String(used + 1), { expirationTtl: 2 * 86_400 });
}

export async function executeInWorkstation(context: ToolContext, job: Omit<WorkstationJob, "runId" | "tenantId">): Promise<WorkstationResult> {
  if (!context.env.WORKSTATION) throw new WorkstationUnavailable();
  await claimRun(context);
  const runId = crypto.randomUUID();
  const result = await workstationFor(context.env, context.tenantId, runId).run({ ...job, runId, tenantId: context.tenantId });
  await emit(context.env, {
    tenantId: context.tenantId,
    agentId: context.agentId,
    threadId: context.threadId,
    projectId: context.projectId,
    type: "sandbox_run",
    data: {
      runId,
      repo: job.repo,
      ref: job.ref,
      command: job.command,
      commit: result.commit,
      ok: result.ok,
      failedAt: result.failedAt,
      durationMs: result.durationMs,
      instanceType: INSTANCE_TYPE,
      steps: result.steps.map(({ name, exitCode, durationMs }) => ({ name, exitCode, durationMs })),
    },
  });
  return result;
}

const sandboxRun: Tool = {
  spec: {
    name: "sandbox_run",
    description: `Baut und testet in einer eigenen Workstation (Container ohne Zugangsdaten, nur lesend): ${COMMAND_NAMES.join(", ")}, vorher pnpm install. Liefert Exit-Codes und das Ende der Ausgabe. Dauert Minuten.`,
    parameters: {
      type: "object",
      properties: {
        command: { type: "string", enum: COMMAND_NAMES },
        ref: { type: "string", description: "Branch/Commit, Standard Arbeitsbranch" },
        repo: { type: "string", description: "owner/name, nur lesend; leer = dieses Projekt" },
      },
      required: ["command"],
    },
  },
  async run(args, context) {
    if (!isCommand(args.command)) throw new ToolInputError(`Befehl muss einer von ${COMMAND_NAMES.join(", ")} sein.`);
    const target = await readTarget(args, context);
    const ref = assertRef(str(args, "ref", target.ref));
    const meta = await repoMeta(context, target.repo);
    if (meta.private) await context.markPrivate?.([meta.full_name]);
    const result = await executeInWorkstation(context, { repo: meta.full_name, ref, private: meta.private, command: args.command });
    return {
      repo: meta.full_name,
      ref,
      commit: result.commit,
      ok: result.ok,
      failedAt: result.failedAt,
      durationSeconds: Math.round(result.durationMs / 1000),
      steps: result.steps.map(({ name, command, exitCode, durationMs, output, truncated }) => ({ name, command, exitCode, seconds: Math.round(durationMs / 1000), truncated, output })),
    };
  },
};

async function hasWranglerConfig(context: ToolContext, ref: string): Promise<boolean> {
  for (const file of WRANGLER_CONFIGS) {
    try {
      await gh(context, `/repos/${context.repo}/contents/${file}?ref=${encodeURIComponent(ref)}`);
      return true;
    } catch {
      // Not there; try the next name.
    }
  }
  return false;
}

const previewDeploy: Tool = {
  requiresApproval: true,
  requiresProject: true,
  spec: {
    name: "preview_deploy",
    description:
      "Schlägt eine öffentliche Cloudflare-Preview-URL für einen Branch oder PR vor (nur mit Wrangler-Konfiguration im Repository). Braucht Ugurs Freigabe.",
    parameters: {
      type: "object",
      properties: {
        branch: { type: "string" },
        pullRequest: { type: "integer", description: "Vorrang vor branch" },
      },
    },
  },
  async run(args, context) {
    const { env } = context;
    if (!env.CF_WORKERS_SUBDOMAIN || !env.AGENT_CF_PREVIEW_TOKEN) {
      throw new ToolInputError("Previews sind nicht eingerichtet: CF_WORKERS_SUBDOMAIN und AGENT_CF_PREVIEW_TOKEN fehlen (ADR 0036).");
    }
    const project = await env.DB.prepare("SELECT id FROM projects WHERE tenant_id = ? AND repo = ? AND status = 'active'").bind(context.tenantId, context.repo).first<{ id: string }>();
    if (!project) throw new ToolInputError("Previews gibt es nur für registrierte Projekte.");

    const pullRequest = Number(args.pullRequest);
    let ref: string;
    let label: string;
    if (Number.isInteger(pullRequest) && pullRequest > 0) {
      ref = (await gh<{ head: { sha: string } }>(context, `/repos/${context.repo}/pulls/${pullRequest}`)).head.sha;
      label = `#${pullRequest}`;
    } else {
      ref = assertRef(str(args, "branch"));
      label = ref;
    }
    if (!(await hasWranglerConfig(context, ref))) {
      throw new ToolInputError("Keine Wrangler-Konfiguration im Wurzelverzeichnis: Dieses Projekt bekommt keine Cloudflare-Preview.");
    }
    const workerName = previewWorkerName(project.id);
    const alias = previewAlias(workerName, pullRequest > 0 ? { pullRequest } : { branch: ref });
    const url = previewUrl(alias, workerName, env.CF_WORKERS_SUBDOMAIN);
    const meta = await repoMeta(context, context.repo);
    if (meta.private) await context.markPrivate?.([meta.full_name]);

    const result = await executeInWorkstation(context, { repo: meta.full_name, ref, private: meta.private, command: "preview", preview: { workerName, alias } });
    const upload = result.steps.find((step) => step.name === "upload");
    const versionId = upload ? versionIdFrom(upload.output) : null;
    const status = result.ok ? "ready" : "failed";
    await savePreview(env, context.tenantId, project.id, { ref: label, alias, url, versionId, status, commit: result.commit });
    await emit(env, {
      tenantId: context.tenantId,
      agentId: context.agentId,
      threadId: context.threadId,
      projectId: project.id,
      type: "preview_deployed",
      data: { ref: label, alias, url, versionId, status, commit: result.commit },
    });
    const failed = result.steps.find((step) => step.exitCode !== 0);
    return result.ok
      ? { url, alias, ref: label, commit: result.commit, versionId }
      : { ok: false, failedAt: result.failedAt, ref: label, output: failed?.output.slice(-4_000) ?? "" };
  },
};

export const sandboxTools: Tool[] = [sandboxRun, previewDeploy];
