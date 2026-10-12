import { randomBytes } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { run } from "../lib/exec.ts";
import {
  accessHint,
  deleteSecrets,
  listSecretNames,
  secretValues,
  setSecret,
  withSecrets,
} from "../lib/infisical.ts";
import { askHidden } from "../lib/prompt.ts";
import type { Stage } from "../lib/stages.ts";
import { isRetired, secretsFor } from "../secrets-manifest.ts";

const section = (title: string, list: string[]) => {
  console.log(`\n${title}: ${list.length}`);
  for (const key of list) console.log(`  - ${key}`);
};

/** Compares Infisical against the manifest. Prints key names only. */
export function secretsAudit(stage: Stage): number {
  const names = listSecretNames(stage);
  if (!names) {
    console.error(accessHint());
    return 1;
  }
  const specs = secretsFor(stage);
  const declared = new Set(specs.map((spec) => spec.key));
  const absent = specs.filter((spec) => !names.filled.includes(spec.key));
  const missing = absent
    .filter((spec) => !spec.optional)
    .map((spec) => (spec.managedBy ? `${spec.key}  (written by \`${spec.managedBy}\`)` : spec.key));
  const optional = absent.filter((spec) => spec.optional).map((spec) => spec.key);
  const present = [...names.filled, ...names.empty];
  const retired = present.filter(isRetired);
  const unknown = present.filter((key) => !declared.has(key) && !isRetired(key));

  console.log(`Stage ${stage}: ${names.filled.length} keys in Infisical, ${declared.size} declared.`);
  section("Missing (required, no value in Infisical)", missing);
  section("Optional (feature stays disabled until configured)", optional);
  section("Retired (remove with `secrets prune`)", retired);
  section("Unknown (not declared in the manifest — declare or remove)", unknown);
  return missing.length + retired.length + unknown.length === 0 ? 0 : 1;
}

/** Removes retired keys from a stage. Dry run unless `apply`. */
export function secretsPrune(stage: Stage, apply: boolean): number {
  const names = listSecretNames(stage);
  if (!names) {
    console.error(accessHint());
    return 1;
  }
  const targets = [...names.filled, ...names.empty].filter(isRetired).sort();
  if (!apply) {
    for (const key of targets) console.log(`would delete ${key}`);
    console.log(`\nDry run (${stage}): ${targets.length} key(s). Re-run with --apply.`);
    return 0;
  }
  const { ok, error } = deleteSecrets(stage, targets);
  if (!ok) {
    console.error(`FAILED deleting keys from ${stage}: ${error ?? "unknown error"}`);
    return 1;
  }
  console.log(`Deleted ${targets.length} key(s) from ${stage}.`);
  return 0;
}

/** Runs any command with the stage's secrets injected: `pnpm ugur secrets run -- <cmd>`. */
export function secretsRun(stage: Stage, command: string[]): number {
  if (command.length === 0) {
    console.error("Usage: pnpm ugur secrets run [--stage dev] -- <command>");
    return 1;
  }
  const invocation = withSecrets(stage, command);
  if (!invocation) {
    console.error(accessHint());
    return 1;
  }
  return run(...invocation).code;
}

/**
 * Sets a declared key in one or both stages from a hidden prompt: `pnpm ugur secrets set KEY`.
 * The value is typed by a person, never shown, never stored in shell history.
 */
export async function secretsSet(key: string | undefined, stages: readonly Stage[]): Promise<number> {
  if (!key) {
    console.error("Usage: pnpm ugur secrets set <KEY> [--stage dev|prod]   (default: both stages)");
    return 1;
  }
  const targets = stages.filter((stage) => secretsFor(stage).some((spec) => spec.key === key));
  if (targets.length === 0) {
    console.error(`${key} is not declared for ${stages.join(", ")} in tooling/cli/src/secrets-manifest.ts.`);
    console.error("Declare it first (docs/operations/secrets.md → Add a variable).");
    return 1;
  }

  let previous: string | null = null;
  for (const stage of targets) {
    const hint = previous ? " (Enter = same as before)" : "";
    const answer = await askHidden(`${key} for ${stage}${hint}: `);
    if (answer === null) {
      console.error("Needs an interactive terminal: run it yourself in a terminal.");
      return 1;
    }
    const value: string | null = answer || previous;
    if (!value) {
      console.error("No value entered — nothing changed.");
      return 1;
    }
    const { ok, error } = setSecret(stage, key, value);
    if (!ok) {
      console.error(`✗ ${key} not set in ${stage}: ${error ?? "unknown error"}`);
      return 1;
    }
    console.log(`✓ ${key} set in ${stage}`);
    previous = value;
  }
  return 0;
}

type Step = { key: string; action: "copy" | "overwrite" | "keep" | "no-source" | "not-declared" };

const LABEL: Record<Step["action"], string> = {
  copy: "copy",
  overwrite: "overwrite",
  keep: "keep (already set; --overwrite to replace)",
  "no-source": "skip: no value in the source",
  "not-declared": "skip: not declared in the manifest",
};

function plan(
  keys: readonly string[],
  declared: Set<string>,
  inSource: Set<string>,
  inTarget: Set<string>,
  overwrite: boolean,
): Step[] {
  return [...new Set(keys)].map((key) => ({
    key,
    action: !declared.has(key)
      ? "not-declared"
      : !inSource.has(key)
        ? "no-source"
        : inTarget.has(key)
          ? overwrite
            ? "overwrite"
            : "keep"
          : "copy",
  }));
}

function write(stage: Stage, values: Record<string, string>): boolean {
  let failed = false;
  for (const [key, value] of Object.entries(values)) {
    const { ok, error } = setSecret(stage, key, value);
    if (ok) console.log(`✓ ${key} set in ${stage}`);
    else {
      failed = true;
      console.error(`✗ ${key} not set in ${stage}: ${error ?? "unknown error"}`);
    }
  }
  return !failed;
}

/**
 * Copies declared keys from one stage to another. Dry run unless `apply`; an existing target
 * value is kept unless `overwrite`. Values stay in memory, never printed.
 */
export function secretsCopy(
  keys: readonly string[],
  from: Stage,
  to: Stage,
  apply: boolean,
  overwrite: boolean,
): number {
  if (from === to || keys.length === 0) {
    console.error("Usage: pnpm ugur secrets copy <KEY…> --from dev --to prod [--apply] [--overwrite]");
    return 1;
  }
  const source = listSecretNames(from);
  const target = listSecretNames(to);
  if (!source || !target) {
    console.error(accessHint());
    return 1;
  }
  const steps = plan(
    keys,
    new Set(secretsFor(to).map((spec) => spec.key)),
    new Set(source.filled),
    new Set(target.filled),
    overwrite,
  );
  console.log(`${from} → ${to}${apply ? "" : " (dry run)"}`);
  for (const step of steps) console.log(`  ${step.key}  ${LABEL[step.action]}`);

  const names = steps.filter((s) => s.action === "copy" || s.action === "overwrite").map((s) => s.key);
  const refused = steps.some((s) => s.action === "not-declared");
  if (!apply || names.length === 0) {
    if (!apply) console.log(`\n${names.length} key(s) would be written. Re-run with --apply.`);
    return refused ? 1 : 0;
  }
  const values = secretValues(from, names);
  if (!values) {
    console.error(`Could not read ${names.join(", ")} from ${from}.`);
    return 1;
  }
  return write(to, values) && !refused ? 0 : 1;
}

/** Parses a dotenv file in memory. Supports `KEY=value`, quotes and `#` comment lines. */
function parseDotenv(text: string): Map<string, string> {
  const values = new Map<string, string>();
  for (const line of text.split(/\r?\n/)) {
    const match = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!match) continue;
    let value = (match[2] ?? "").trim();
    const quoted = value.match(/^(["'])(.*)\1$/);
    if (quoted) value = quoted[2] ?? "";
    else value = value.replace(/\s+#.*$/, "");
    if (value) values.set(match[1] as string, value);
  }
  return values;
}

/**
 * One-time move of an existing `.env` file into Infisical: only declared keys, values never
 * printed. Dry run unless `apply`; an existing value is kept unless `overwrite`.
 */
export function secretsImport(file: string | undefined, stage: Stage, apply: boolean, overwrite: boolean): number {
  if (!file) {
    console.error("Usage: pnpm ugur secrets import <file> [--stage dev] [--apply] [--overwrite]");
    return 1;
  }
  const path = resolve(process.cwd(), file);
  if (!existsSync(path)) {
    console.error(`No such file: ${file}`);
    return 1;
  }
  const target = listSecretNames(stage);
  if (!target) {
    console.error(accessHint());
    return 1;
  }
  const source = parseDotenv(readFileSync(path, "utf8"));
  const steps = plan(
    [...source.keys()],
    new Set(secretsFor(stage).map((spec) => spec.key)),
    new Set(source.keys()),
    new Set(target.filled),
    overwrite,
  );
  console.log(`${file} → ${stage}${apply ? "" : " (dry run)"}`);
  for (const step of steps) {
    console.log(`  ${step.key}  ${isRetired(step.key) ? "skip: retired key" : LABEL[step.action]}`);
  }

  const names = steps.filter((s) => s.action === "copy" || s.action === "overwrite").map((s) => s.key);
  if (!apply) {
    console.log(`\n${names.length} key(s) would be written. Re-run with --apply.`);
    return 0;
  }
  const ok = write(stage, Object.fromEntries(names.map((key) => [key, source.get(key) as string])));
  if (ok && names.length > 0) console.log(`\nImported. Delete ${file} once \`pnpm dev\` works without it.`);
  return ok ? 0 : 1;
}

/**
 * Creates the random secrets of our own making (signing keys, tokens) that a stage lacks.
 * Each stage gets its own values. `rotate` replaces existing ones too. Dry run unless `apply`.
 */
export function secretsGenerate(stage: Stage, apply: boolean, rotate: boolean): number {
  const names = listSecretNames(stage);
  if (!names) {
    console.error(accessHint());
    return 1;
  }
  const targets = secretsFor(stage)
    .filter((spec) => spec.random && (rotate || !names.filled.includes(spec.key)))
    .map((spec) => spec.key);
  for (const key of targets) {
    console.log(`  ${key}  ${names.filled.includes(key) ? "rotate" : "create"}`);
  }
  if (!apply) {
    console.log(`
Dry run (${stage}): ${targets.length} key(s). Re-run with --apply.`);
    return 0;
  }
  const values = Object.fromEntries(targets.map((key) => [key, randomBytes(48).toString("base64url")]));
  return write(stage, values) ? 0 : 1;
}
