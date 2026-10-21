import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { REPO_ROOT, run } from "./exec.ts";
import { STAGES, type Stage } from "./stages.ts";

/** EU cloud, like every other project of ours. */
export const INFISICAL_DOMAIN = "https://eu.infisical.com";
export const INFISICAL_FILE = join(REPO_ROOT, ".infisical.json");

interface InfisicalConfig {
  /** Infisical's own key for the project id in `.infisical.json`. */
  workspaceId: string;
  domain: string;
}

/** `null` until `pnpm ugur setup` has linked this checkout to its Infisical project. */
export function infisicalConfig(): InfisicalConfig | null {
  if (!existsSync(INFISICAL_FILE)) return null;
  const config = JSON.parse(readFileSync(INFISICAL_FILE, "utf8")) as Partial<InfisicalConfig>;
  if (!config.workspaceId) return null;
  return { workspaceId: config.workspaceId, domain: config.domain ?? INFISICAL_DOMAIN };
}

/** Rewrites `.infisical.json` into our fixed shape, keeping only the project id. */
export function writeInfisicalConfig(workspaceId: string): void {
  const config = {
    workspaceId,
    defaultEnvironment: STAGES.dev.infisical,
    domain: INFISICAL_DOMAIN,
    gitBranchToEnvironmentMapping: Object.fromEntries(
      Object.values(STAGES).map((stage) => [stage.branch, stage.infisical]),
    ),
  };
  writeFileSync(INFISICAL_FILE, `${JSON.stringify(config, null, 2)}\n`);
}

function baseArgs(stage: Stage): string[] | null {
  const config = infisicalConfig();
  if (!config) return null;
  return ["--env", STAGES[stage].infisical, "--projectId", config.workspaceId, "--domain", config.domain];
}

export interface SecretNames {
  /** Keys with a value. */
  filled: string[];
  /** Keys that exist but are empty. */
  empty: string[];
}

/** Why the last read failed, in Infisical's own words (never contains secret values). */
let lastReadError: string | null = null;

function exportRows(stage: Stage): Array<{ key: string; value: string }> | null {
  const base = baseArgs(stage);
  if (!base) return null;
  const { code, stdout, stderr } = run(
    "infisical",
    ["export", ...base, "--path", "/", "--format", "json", "--silent"],
    { capture: true },
  );
  lastReadError = code === 0 ? null : (stderr.match(/^Message:\s*(.+)$/m)?.[1]?.trim() ?? null);
  if (code !== 0) return null;
  try {
    return JSON.parse(stdout || "[]") as Array<{ key: string; value: string }>;
  } catch {
    return null;
  }
}

/**
 * Secret *names* only. Values are parsed in-process and discarded, never printed —
 * the CLI must stay safe to run in shared terminals and agent sessions.
 */
export function listSecretNames(stage: Stage): SecretNames | null {
  const rows = exportRows(stage);
  if (!rows) return null;
  const keys = (empty: boolean) =>
    rows
      .filter((row) => (row.value === "") === empty)
      .map((row) => row.key)
      .sort();
  return { filled: keys(false), empty: keys(true) };
}

/** Allow-listed secret values, in memory only; `null` when one of them is missing. */
export function secretValues(stage: Stage, keys: readonly string[]): Record<string, string> | null {
  const rows = exportRows(stage);
  if (!rows) return null;
  const available = new Map(rows.map((row) => [row.key, row.value]));
  const values: Record<string, string> = {};
  for (const key of keys) {
    const value = available.get(key);
    if (!value) return null;
    values[key] = value;
  }
  return values;
}

const lastErrorLine = (stderr: string, redact?: string) =>
  stderr
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !(redact && line.includes(redact)) && !/release|winget/i.test(line))
    .at(-1);

/**
 * Sets one shared secret at `/`. The value never becomes a process argument, where process
 * lists and endpoint telemetry could read it: it is written to a file only this user can read,
 * in a private temporary directory, handed to Infisical as `KEY=@file` and removed right after.
 * stdout (which echoes the secret) is discarded and only the last stderr line is reported.
 */
export function setSecret(stage: Stage, key: string, value: string): { ok: boolean; error?: string } {
  const base = baseArgs(stage);
  if (!base) return { ok: false, error: "not linked to an Infisical project (pnpm ugur setup)" };
  const dir = mkdtempSync(join(tmpdir(), "ugur-secret-"));
  const file = join(dir, "value");
  try {
    writeFileSync(file, value, { mode: 0o600 });
    const args = ["secrets", "set", `${key}=@${file}`, ...base, "--path", "/", "--type", "shared", "--silent"];
    const result = spawnSync("infisical", args, { stdio: ["ignore", "ignore", "pipe"], encoding: "utf8" });
    if (result.status === 0) return { ok: true };
    const error = lastErrorLine(result.stderr ?? "", value);
    return error ? { ok: false, error } : { ok: false };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

/** Deletes shared secrets at `/`. Errors carry key names, never values. */
export function deleteSecrets(stage: Stage, keys: string[]): { ok: boolean; error?: string } {
  if (keys.length === 0) return { ok: true };
  const base = baseArgs(stage);
  if (!base) return { ok: false, error: "not linked to an Infisical project (pnpm ugur setup)" };
  const args = ["secrets", "delete", ...keys, ...base, "--path", "/", "--type", "shared", "--silent"];
  const { code, stderr } = run("infisical", args, { capture: true });
  if (code === 0) return { ok: true };
  const error = lastErrorLine(stderr);
  return error ? { ok: false, error } : { ok: false };
}

/** `infisical run` — injects secrets as env vars for one process; nothing touches disk. */
export function withSecrets(stage: Stage, command: string[]): [string, string[]] | null {
  const base = baseArgs(stage);
  if (!base) return null;
  return ["infisical", ["run", ...base, "--path", "/", "--silent", "--", ...command]];
}

export const SETUP_HINT = "Not linked to Infisical yet — run `pnpm ugur setup`.";
export const LOGIN_HINT = `Cannot read Infisical — run \`infisical login --domain=${INFISICAL_DOMAIN}\` (or \`pnpm ugur setup\`).`;

export const RELINK_HINT =
  "This checkout is linked to an Infisical project that your selected organization cannot access. Select the correct organization and this product's dedicated \"Secrets Management\" project, then run `pnpm ugur setup --relink`. Do not link the ViralSync project.";

/** The right hint for a failed read: not linked, linked to an unusable project, or not signed in. */
export function accessHint(): string {
  if (!infisicalConfig()) return SETUP_HINT;
  if (!lastReadError) return LOGIN_HINT;
  const wrongProject = /project is of type|not found|does not belong to your selected organization/i.test(lastReadError);
  return [`Infisical refused: ${lastReadError}`, wrongProject ? RELINK_HINT : LOGIN_HINT].join("\n");
}
