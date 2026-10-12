import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../../..");

const isWindows = process.platform === "win32";

export interface RunOptions {
  cwd?: string;
  env?: Record<string, string>;
  /** Capture stdout instead of streaming it. Use only for non-secret output. */
  capture?: boolean;
  /** Pipe sensitive data to stdin without adding it to command arguments or logs. */
  input?: string;
}

export interface RunResult {
  code: number;
  stdout: string;
  stderr: string;
}

const quote = (arg: string) =>
  /^[\w@%+=:,./-]+$/.test(arg) ? arg : `"${arg.replaceAll('"', '\\"')}"`;

/** Runs a command; on Windows through the shell so `.cmd` shims (pnpm, wrangler) resolve. */
export function run(command: string, args: string[], options: RunOptions = {}): RunResult {
  const result = spawnSync(
    isWindows ? [command, ...args].map(quote).join(" ") : command,
    isWindows ? [] : args,
    {
      cwd: options.cwd ?? REPO_ROOT,
      env: { ...process.env, ...options.env },
      stdio: options.capture
        ? [options.input === undefined ? "ignore" : "pipe", "pipe", "pipe"]
        : "inherit",
      encoding: "utf8",
      shell: isWindows,
      input: options.input,
    },
  );
  return { code: result.status ?? 1, stdout: result.stdout ?? "", stderr: result.stderr ?? "" };
}

export function has(command: string): boolean {
  return run(command, ["--version"], { capture: true }).code === 0;
}
