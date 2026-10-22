import { createConnection, createServer } from "node:net";
import { REPO_ROOT, run } from "../lib/exec.ts";
import { accessHint, listSecretNames, withSecrets } from "../lib/infisical.ts";
import { runManagedProcess } from "../lib/managed-process.ts";
import { LOCAL_ORIGINS, type Stage } from "../lib/stages.ts";

const LOCAL_RUN = "tooling/cli/src/local-run.ts";

type AppName = keyof typeof LOCAL_ORIGINS;

const APPS = Object.keys(LOCAL_ORIGINS) as AppName[];
/** What `pnpm dev` starts: the public site. The portal is opt-in (`--filter portal`, `--all`). */
const DEFAULT_APPS: AppName[] = ["site"];

const port = (app: AppName) => Number(new URL(LOCAL_ORIGINS[app]).port);

export interface DevOptions {
  all?: boolean;
}

/** The apps a dev run starts, or the filters that name no app. */
export function selectApps(filters: string[], all = false): AppName[] | { unknown: string[] } {
  const unknown = filters.filter((filter) => !APPS.includes(filter as AppName));
  if (unknown.length > 0) return { unknown };
  if (filters.length > 0) return APPS.filter((app) => filters.includes(app));
  return all ? APPS : DEFAULT_APPS;
}

function portIsFree(candidate: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = createServer();
    server.once("error", () => resolve(false));
    server.listen(candidate, "::", () => server.close(() => resolve(true)));
  });
}

function portAccepts(candidate: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = createConnection({ port: candidate, host: "localhost" });
    const finish = (open: boolean) => {
      socket.destroy();
      resolve(open);
    };
    socket.setTimeout(500);
    socket.once("connect", () => finish(true));
    socket.once("timeout", () => finish(false));
    socket.once("error", () => finish(false));
  });
}

/** Reports when each app accepts connections and how long that took since the command started. */
async function reportReadiness(apps: AppName[], startedAt: number, signal: AbortSignal): Promise<void> {
  const deadline = startedAt + 90_000;
  const waitFor = async (app: AppName): Promise<boolean> => {
    while (Date.now() < deadline && !signal.aborted) {
      if (await portAccepts(port(app))) {
        const seconds = ((Date.now() - startedAt) / 1000).toFixed(1);
        console.log(`[dev] ${app} ready at ${LOCAL_ORIGINS[app]} after ${seconds} s`);
        return true;
      }
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
    return false;
  };
  const ready = await Promise.all(apps.map(waitFor));
  const waiting = apps.filter((_, index) => !ready[index]);
  if (waiting.length > 0 && !signal.aborted) {
    console.warn(`[dev] Still waiting for ${waiting.join(", ")}. Check the logs above.`);
  }
}

/**
 * Runs the selected apps with the dev stage's secrets injected and this machine's own addresses.
 * Only the apps start: workspace packages are compiled from source by Next, so nothing is built
 * or watched beside them.
 */
export async function dev(filters: string[], options: DevOptions = {}): Promise<number> {
  const startedAt = Date.now();
  const apps = selectApps(filters, options.all);
  if (!Array.isArray(apps)) {
    console.error(`Unknown app "${apps.unknown.join(", ")}". Use: ${APPS.join(", ")}.`);
    return 1;
  }

  if (!listSecretNames("dev")) {
    console.error(accessHint());
    return 1;
  }

  const free = await Promise.all(apps.map((app) => portIsFree(port(app))));
  const occupied = apps.filter((_, index) => !free[index]);
  if (occupied.length > 0) {
    const list = occupied.map((app) => `${port(app)} (${app})`).join(", ");
    console.error(`Cannot start dev: port ${list} is already in use. Run \`pnpm kill:ports\` or stop the running app, then retry.`);
    return 1;
  }

  const turbo = [
    "pnpm",
    "exec",
    "turbo",
    "run",
    "dev",
    "--ui=stream",
    ...apps.map((app) => `--filter=@ugur/${app}`),
  ];
  const invocation = withSecrets("dev", ["node", LOCAL_RUN, ...turbo]);
  if (!invocation) {
    console.error(accessHint());
    return 1;
  }

  const hint = apps.length < APPS.length ? ` (pnpm dev:all starts ${APPS.join(" + ")})` : "";
  console.log(`[dev] Starting ${apps.join(" + ")}${hint}.`);
  const readiness = new AbortController();
  const report = reportReadiness(apps, startedAt, readiness.signal);
  try {
    return await runManagedProcess(...invocation, {
      cwd: REPO_ROOT,
      stdio: "inherit",
      onSignal: () => readiness.abort(),
    });
  } finally {
    readiness.abort();
    await report;
  }
}

/** Runs one command with a stage's secrets and local addresses, e.g. a production build. */
export function localRun(stage: Stage, command: string[]): number {
  if (command.length === 0) {
    console.error("Usage: pnpm ugur run [--stage dev] -- <command>");
    return 1;
  }
  const invocation = withSecrets(stage, ["node", LOCAL_RUN, ...command]);
  if (!invocation) {
    console.error(accessHint());
    return 1;
  }
  return run(...invocation).code;
}
