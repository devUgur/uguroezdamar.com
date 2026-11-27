import { DurableObject } from "cloudflare:workers";
import type { Env } from "../env.ts";
import { platformFrom, type CloudflareBindings } from "./platform.ts";
import { MAX_RUN_SECONDS, previewSteps, stepsFor, tail } from "../workstation/commands.ts";
import type { GatewayProps } from "./gateways.ts";
import { type StepResult, WorkstationUnavailable, type WorkstationJob, type WorkstationPort, type WorkstationResult } from "../workstation/port.ts";

const WORKDIR = "/workspace/repo";
/** The gateways terminate TLS with this CA; git, Node and pnpm are told to trust it. No credential is in here. */
const CA = "/etc/cloudflare/certs/cloudflare-containers-ca.crt";
const BASE_ENV: Record<string, string> = {
  GIT_SSL_CAINFO: CA,
  NODE_EXTRA_CA_CERTS: CA,
  GIT_TERMINAL_PROMPT: "0",
  COREPACK_ENABLE_DOWNLOAD_PROMPT: "0",
  CI: "true",
  HOME: "/workspace",
};

type Exports = Record<string, (options: { props: GatewayProps }) => Fetcher>;
const decoder = new TextDecoder();

/**
 * One container for one run (ADR 0036). The Worker names a new object per run (port.ts), so runs never share
 * files or processes. The container has no Internet: only the hosts intercepted below, each through a gateway.
 * Whatever happens, the container is destroyed at the end; an alarm and the inactivity timeout are backups.
 */
export class Workstation extends DurableObject<CloudflareBindings> implements WorkstationPort {
  async run(job: WorkstationJob): Promise<WorkstationResult> {
    const container = this.ctx.container;
    if (!container) throw new WorkstationUnavailable();
    const started = Date.now();
    const deadline = started + MAX_RUN_SECONDS * 1000;
    await this.ctx.storage.setAlarm(deadline + 60_000);

    const exports = (this.ctx as unknown as { exports: Exports }).exports;
    const props: GatewayProps = { tenantId: job.tenantId, repo: job.repo, private: job.private, previewWorker: job.preview?.workerName };
    await container.interceptOutboundHttps("github.com", exports.GitGateway!({ props }));
    await container.interceptOutboundHttps("registry.npmjs.org", exports.RegistryGateway!({ props }));
    if (job.preview) await container.interceptOutboundHttps("api.cloudflare.com", exports.PreviewGateway!({ props }));

    const env: Record<string, string> = { ...BASE_ENV };
    if (job.preview) {
      // Wrangler insists on a token; the gateway replaces it, so the container only ever holds this placeholder.
      env.CLOUDFLARE_API_TOKEN = "via-gateway";
      env.CLOUDFLARE_ACCOUNT_ID = this.env.CF_ACCOUNT_ID;
      env.WRANGLER_SEND_METRICS = "false";
    }
    if (!container.running) container.start({ enableInternet: false, env });
    await container.setInactivityTimeout((MAX_RUN_SECONDS + 30) * 1000);

    const steps: StepResult[] = [];
    const exec = async (name: string, argv: string[], timeoutSeconds: number, cwd?: string): Promise<StepResult> => {
      const seconds = Math.max(1, Math.min(timeoutSeconds, Math.floor((deadline - Date.now()) / 1000)));
      const begin = Date.now();
      const process = await container.exec(["timeout", "-k", "5", String(seconds), ...argv], { cwd, env, stderr: "combined" });
      const output = await process.output();
      const text = tail(decoder.decode(output.stdout));
      const step = { name, command: argv.join(" "), exitCode: output.exitCode, durationMs: Date.now() - begin, output: text.text, truncated: text.truncated };
      steps.push(step);
      return step;
    };

    let commit: string | null = null;
    let failedAt: string | null = null;
    try {
      const url = `https://github.com/${job.repo}.git`;
      const clone: [string, string[]][] = [
        ["init", ["git", "init", "--quiet", WORKDIR]],
        ["remote", ["git", "-C", WORKDIR, "remote", "add", "origin", url]],
        ["fetch", ["git", "-C", WORKDIR, "fetch", "--depth", "1", "--quiet", "origin", job.ref]],
        ["checkout", ["git", "-C", WORKDIR, "checkout", "--quiet", "--detach", "FETCH_HEAD"]],
      ];
      for (const [name, argv] of clone) {
        if ((await exec(`clone:${name}`, argv, 120)).exitCode !== 0) {
          failedAt = `clone:${name}`;
          break;
        }
      }
      if (!failedAt) {
        const head = await container.exec(["git", "-C", WORKDIR, "rev-parse", "HEAD"], { env });
        commit = decoder.decode((await head.output()).stdout).trim() || null;
        const lockfile = (await (await container.exec(["test", "-f", `${WORKDIR}/pnpm-lock.yaml`])).output()).exitCode === 0;
        const plan = job.command === "preview" && job.preview ? previewSteps(lockfile, job.preview.workerName, job.preview.alias) : job.command === "preview" ? [] : stepsFor(job.command, lockfile);
        for (const step of plan) {
          if (Date.now() >= deadline) {
            failedAt = `${step.name} (Zeitlimit des Laufs)`;
            break;
          }
          if ((await exec(step.name, step.argv, step.timeoutSeconds, WORKDIR)).exitCode !== 0) {
            failedAt = step.name;
            break;
          }
        }
      }
    } finally {
      await this.cleanUp();
    }
    return { runId: job.runId, commit, ok: failedAt === null, failedAt, steps, durationMs: Date.now() - started };
  }

  /** Backup for a run that never reached its finally block. */
  async alarm(): Promise<void> {
    await this.cleanUp();
  }

  private async cleanUp(): Promise<void> {
    const container = this.ctx.container;
    if (container?.running) await container.destroy().catch((error: unknown) => console.error("workstation destroy failed", error));
    await this.ctx.storage.deleteAlarm();
    await this.ctx.storage.deleteAll();
  }
}
