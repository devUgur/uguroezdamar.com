import { run } from "../lib/exec.ts";
import { accessHint, withSecrets } from "../lib/infisical.ts";
import type { Stage } from "../lib/stages.ts";

const APPS = ["site", "portal"] as const;
const LOCAL_RUN = "tooling/cli/src/local-run.ts";

/** Runs the apps with the dev stage's secrets injected and this machine's own addresses. */
export function dev(filters: string[]): number {
  const unknown = filters.filter((filter) => !APPS.includes(filter as (typeof APPS)[number]));
  if (unknown.length > 0) {
    console.error(`Unknown app "${unknown.join(", ")}". Use: ${APPS.join(", ")}.`);
    return 1;
  }
  const turbo = ["pnpm", "exec", "turbo", "dev", ...filters.map((app) => `--filter=@ugur/${app}`)];
  const invocation = withSecrets("dev", ["node", LOCAL_RUN, ...turbo]);
  if (!invocation) {
    console.error(accessHint());
    return 1;
  }
  return run(...invocation).code;
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
