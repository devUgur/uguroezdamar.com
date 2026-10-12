import { run } from "../lib/exec.ts";
import { accessHint, infisicalConfig, listSecretNames, setSecret, withSecrets } from "../lib/infisical.ts";
import {
  connectionString,
  createBranch,
  createProject,
  findProject,
  listBranches,
  NEON_PROJECT_NAME,
  NEON_REGION,
  neonLoggedIn,
  orgArgs,
  renameBranch,
} from "../lib/neon.ts";
import { STAGES, type Stage } from "../lib/stages.ts";

const COMMANDS = ["generate", "check", "migrate", "studio", "provision"] as const;
type DbCommand = (typeof COMMANDS)[number];

const MIGRATIONS = "packages/server/drizzle";
const script = (name: string) => ["pnpm", "--filter", "@ugur/server", `db:${name}`];
/** Needs no database: runs without secrets. */
const offline = (name: string) => run("pnpm", script(name).slice(1)).code;
/** Runs against the stage's database with its secrets injected. */
function online(name: string, stage: Stage): number {
  const invocation = withSecrets(stage, script(name));
  if (!invocation) {
    console.error(accessHint());
    return 1;
  }
  return run(...invocation).code;
}

/**
 * Offline: migrations are consistent, and the schema has no change without a migration —
 * `generate` must leave the migrations folder untouched. Runs in `pnpm check` and CI.
 */
function check(): number {
  const status = () =>
    run("git", ["status", "--porcelain", "--untracked-files=all", "--", MIGRATIONS], { capture: true }).stdout;
  const before = status();
  if (offline("check") !== 0 || offline("generate") !== 0) return 1;
  if (status() !== before) {
    console.error("\nThe schema changed without a migration; `generate` just created one.");
    console.error(`Review it in ${MIGRATIONS} and commit it with the schema change.`);
    return 1;
  }
  console.log("Migrations are consistent and up to date with the schema.");
  return 0;
}

/**
 * Creates what is missing and never deletes: the Neon project, one branch per stage, and each
 * stage's two connection strings in Infisical. Dry run unless `apply`. Connection strings go
 * from Neon to Infisical in memory and are never printed.
 */
function provision(apply: boolean, overwrite: boolean): number {
  if (!infisicalConfig()) {
    console.error(accessHint());
    return 1;
  }
  if (!neonLoggedIn()) {
    console.error("Not signed in to Neon — run `neon auth` (or `pnpm ugur setup`).");
    return 1;
  }
  const org = orgArgs();
  const existing = findProject(org);
  if (existing === undefined) {
    console.error("Could not list Neon projects. With several organizations, set NEON_ORG_ID.");
    return 1;
  }
  const stages = Object.keys(STAGES) as Stage[];
  const secrets = Object.fromEntries(stages.map((stage) => [stage, listSecretNames(stage)]));
  if (stages.some((stage) => !secrets[stage])) {
    console.error(accessHint());
    return 1;
  }
  const needsUrls = (stage: Stage) =>
    overwrite || !["DATABASE_URL", "DATABASE_URL_DIRECT"].every((key) => secrets[stage]?.filled.includes(key));

  if (!apply) {
    console.log(
      existing
        ? `Neon project "${NEON_PROJECT_NAME}" exists (${existing.id}).`
        : `Would create Neon project "${NEON_PROJECT_NAME}" in ${NEON_REGION}.`,
    );
    const branches = existing ? (listBranches(existing.id) ?? []).map((branch) => branch.name) : [];
    for (const stage of stages) {
      const branch = STAGES[stage].neon;
      console.log(`  ${stage}: branch "${branch}" ${branches.includes(branch) ? "exists" : "would be created"}; ` +
        `connection strings ${needsUrls(stage) ? "would be written to Infisical" : "already in Infisical (kept)"}`);
    }
    console.log("\nDry run. Re-run with --apply.");
    return 0;
  }

  const projectId = existing?.id ?? createProject(org);
  if (!projectId) {
    console.error("Could not create the Neon project.");
    return 1;
  }
  if (!existing) console.log(`✓ Neon project "${NEON_PROJECT_NAME}" created (${projectId})`);

  let branches = listBranches(projectId);
  if (!branches) {
    console.error("Could not list the project's branches.");
    return 1;
  }
  const prod = STAGES.prod.neon;
  if (!branches.some((branch) => branch.name === prod)) {
    const root = branches.find((branch) => branch.default || branch.primary) ?? branches[0];
    if (!root || !renameBranch(projectId, root.name, prod)) {
      console.error(`Could not name the default branch "${prod}".`);
      return 1;
    }
    console.log(`✓ default branch named "${prod}"`);
    branches = listBranches(projectId) ?? [];
  }
  for (const stage of stages) {
    const branch = STAGES[stage].neon;
    if (branches.some((entry) => entry.name === branch)) continue;
    if (!createBranch(projectId, branch, prod)) {
      console.error(`Could not create branch "${branch}".`);
      return 1;
    }
    console.log(`✓ branch "${branch}" created`);
  }

  for (const stage of stages) {
    if (!needsUrls(stage)) {
      console.log(`- ${stage}: connection strings already in Infisical (kept; --overwrite to replace)`);
      continue;
    }
    const urls = {
      DATABASE_URL: connectionString(projectId, STAGES[stage].neon, true),
      DATABASE_URL_DIRECT: connectionString(projectId, STAGES[stage].neon, false),
    };
    for (const [key, value] of Object.entries(urls)) {
      const result = value ? setSecret(stage, key, value) : { ok: false, error: "no connection string from Neon" };
      if (!result.ok) {
        console.error(`✗ ${key} not set in ${stage}: ${result.error ?? "unknown error"}`);
        return 1;
      }
      console.log(`✓ ${key} set in ${stage}`);
    }
  }
  console.log("\nNext: `pnpm ugur db migrate` (dev), then `pnpm ugur db migrate --stage prod`.");
  return 0;
}

export function db(command: string | undefined, stage: Stage, apply: boolean, overwrite: boolean): number {
  if (!COMMANDS.includes(command as DbCommand)) {
    console.error(`Usage: pnpm ugur db <${COMMANDS.join("|")}> [--stage dev|prod] [--apply]`);
    return 1;
  }
  switch (command as DbCommand) {
    case "generate":
      return offline("generate");
    case "check":
      return check();
    case "migrate":
      if (stage !== "dev") console.log(`Migrating ${stage}.`);
      return online("migrate", stage);
    case "studio":
      return online("studio", stage);
    case "provision":
      return provision(apply, overwrite);
  }
}
