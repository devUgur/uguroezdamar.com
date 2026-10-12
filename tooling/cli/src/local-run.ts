import { spawnSync } from "node:child_process";
import { localEnv } from "./lib/stages.ts";

/**
 * Runs a command as a local run: started under `infisical run`, so the stage's secrets are in
 * the environment, with the address variables replaced by this machine's own. The hosted
 * addresses stay in Infisical and no machine's address ever lands in a shared value.
 */
const [bin, ...args] = process.argv.slice(2);
if (!bin) process.exit(1);

const isWindows = process.platform === "win32";
const quote = (arg: string) => (/^[\w@%+=:,./-]+$/.test(arg) ? arg : `"${arg.replaceAll('"', '\\"')}"`);
const result = spawnSync(isWindows ? [bin, ...args].map(quote).join(" ") : bin, isWindows ? [] : args, {
  stdio: "inherit",
  shell: isWindows,
  env: { ...process.env, NEXT_TELEMETRY_DISABLED: process.env.NEXT_TELEMETRY_DISABLED ?? "1", ...localEnv() },
});
process.exitCode = result.status ?? 1;
