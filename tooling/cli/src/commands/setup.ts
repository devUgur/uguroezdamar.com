import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { createInterface } from "node:readline/promises";
import { tmpdir } from "node:os";
import { isAbsolute, join, relative, resolve } from "node:path";
import { has, REPO_ROOT, run } from "../lib/exec.ts";
import {
  accessHint,
  INFISICAL_DOMAIN,
  INFISICAL_PROFILE,
  infisicalConfig,
  listSecretNames,
  writeInfisicalConfig,
} from "../lib/infisical.ts";
import { neonLoggedIn } from "../lib/neon.ts";
import { STAGES, type Stage } from "../lib/stages.ts";

const step = (text: string) => console.log(`\n▸ ${text}`);
const CLOUDFLARE_PROFILE = "uguroezdamar";

async function ensureCloudflareProfile(): Promise<boolean> {
  if (!has("wrangler")) {
    console.error("Wrangler CLI not found → install it with `npm install --global wrangler`, then run `pnpm ugur setup` again.");
    return false;
  }
  if (process.env.CLOUDFLARE_API_TOKEN) {
    console.error("CLOUDFLARE_API_TOKEN is set and overrides Wrangler profiles. Unset it before running `pnpm ugur setup` so this checkout can be bound to its own profile.");
    return false;
  }

  const profiles = run("wrangler", ["auth", "list"], { cwd: REPO_ROOT, capture: true });
  if (profiles.code !== 0) {
    console.error("Could not inspect Wrangler auth profiles.");
    return false;
  }
  const hasProfile = new RegExp(`(^|\\s)${CLOUDFLARE_PROFILE}(\\s|$)`, "m").test(profiles.stdout);
  let createdProfile = false;
  if (!hasProfile) {
    step("Sign in with the Cloudflare account that owns uguroezdamar.com. The new Wrangler profile requests account and zone read access only; DNS writes stay in Cloudflare's zone dashboard.");
    if (run("wrangler", ["auth", "create", CLOUDFLARE_PROFILE, "--scopes", "account:read", "--scopes", "user:read", "--scopes", "zone:read"], { cwd: REPO_ROOT }).code !== 0) {
      console.error("Cloudflare profile creation failed or was cancelled.");
      return false;
    }
    createdProfile = true;
  }

  if (run("wrangler", ["auth", "activate", CLOUDFLARE_PROFILE, REPO_ROOT], { cwd: REPO_ROOT }).code !== 0) {
    console.error(`Could not bind Wrangler profile '${CLOUDFLARE_PROFILE}' to this checkout.`);
    return false;
  }

  const identity = run("wrangler", ["whoami"], { cwd: REPO_ROOT, capture: true });
  if (identity.code !== 0) {
    run("wrangler", ["auth", "deactivate", REPO_ROOT], { cwd: REPO_ROOT });
    if (createdProfile) run("wrangler", ["auth", "delete", CLOUDFLARE_PROFILE], { cwd: REPO_ROOT });
    console.error("Could not verify the active Cloudflare identity. Run `pnpm exec wrangler whoami` from this repository and check the profile before using Cloudflare.");
    return false;
  }
  console.log(identity.stdout.trim());
  const readline = createInterface({ input: process.stdin, output: process.stdout });
  let confirmation = "";
  try {
    confirmation = (await readline.question("After checking the account above, type uguroezdamar.com only if it owns that DNS zone: ")).trim();
  } finally {
    readline.close();
  }
  if (confirmation !== "uguroezdamar.com") {
    run("wrangler", ["auth", "deactivate", REPO_ROOT], { cwd: REPO_ROOT });
    if (createdProfile) run("wrangler", ["auth", "delete", CLOUDFLARE_PROFILE], { cwd: REPO_ROOT });
    console.error("Cloudflare zone ownership was not confirmed. No DNS changes were made; verify the account and rerun `pnpm ugur setup`.");
    return false;
  }
  console.log(`✓ Wrangler profile '${CLOUDFLARE_PROFILE}' is bound to this repository (read-only account/zone scopes)`);
  return true;
}

function supportsNamedProfilesAndYaml(): boolean {
  const result = run("infisical", ["--version"], { capture: true });
  const version = result.stdout.match(/(\d+)\.(\d+)\.(\d+)/);
  const required = [0, 43, 145];
  const current = version?.slice(1).map(Number);
  if (!current) return false;
  for (let index = 0; index < required.length; index += 1) {
    if (current[index]! > required[index]!) return true;
    if (current[index]! < required[index]!) return false;
  }
  return true;
}

function selectedWorkspaceId(path: string): string | null {
  try {
    return readFileSync(path, "utf8").match(/^\s+project-id:\s*([0-9a-f-]{36})\s*$/im)?.[1] ?? null;
  } catch {
    return null;
  }
}

function verifyProjectAccess(workspaceId: string, stage: Stage, cwd: string): boolean {
  const result = run(
    "infisical",
    ["export", "--env", STAGES[stage].infisical, "--projectId", workspaceId, "--domain", INFISICAL_DOMAIN, "--path", "/", "--format", "json", "--silent"],
    { cwd, capture: true, env: { INFISICAL_PROFILE } },
  );
  if (result.code === 0) return true;
  const detail = result.stderr.match(/^Message:\s*(.+)$/m)?.[1]?.trim();
  console.error(`Infisical project access failed for ${stage}${detail ? `: ${detail}` : "."}`);
  return false;
}

function removeTemporaryDirectory(path: string): void {
  const root = resolve(tmpdir());
  const target = resolve(path);
  const relativeTarget = relative(root, target);
  if (!relativeTarget || relativeTarget.startsWith("..") || isAbsolute(relativeTarget)) {
    throw new Error("Refusing to remove a path outside the temporary directory.");
  }
  rmSync(target, { recursive: true, force: true });
}

function ensureDedicatedProfile(): boolean {
  const profiles = run("infisical", ["profile", "list"], { capture: true });
  if (!supportsNamedProfilesAndYaml() || profiles.code !== 0) {
    console.error("This setup needs Infisical CLI v0.43.145 or newer for named login profiles and `.infisical.yaml`. Upgrade Infisical, then run `pnpm ugur setup` again.");
    return false;
  }

  if (!new RegExp(`(^|\\s)${INFISICAL_PROFILE}(\\s|$)`, "m").test(profiles.stdout)) {
    step(`Sign in to the dedicated uguroezdamar.com Infisical account in the browser (not the ViralSync account).`);
    if (run("infisical", ["login", `--save-as=${INFISICAL_PROFILE}`, `--domain=${INFISICAL_DOMAIN}`]).code !== 0) return false;
  }

  if (run("infisical", ["profile", "bind", INFISICAL_PROFILE, REPO_ROOT]).code !== 0) {
    console.error(`Could not bind Infisical profile '${INFISICAL_PROFILE}' to this checkout.`);
    return false;
  }
  const current = run("infisical", ["profile", "current", "--plain"], { capture: true });
  if (current.code !== 0 || current.stdout.trim() !== INFISICAL_PROFILE) {
    console.error(`Infisical profile mismatch. Expected '${INFISICAL_PROFILE}' for ${REPO_ROOT}; current: ${current.stdout.trim() || "unknown"}.`);
    return false;
  }
  console.log(`✓ Infisical login profile: ${INFISICAL_PROFILE} (bound to this repository)`);
  return true;
}

/**
 * One-time onboarding of a machine: sign in to Infisical, Neon, and the read-only Cloudflare profile
 * in the browser, and link this
 * checkout to its Infisical project. Every step is skipped when it is already done, so the
 * command is safe to repeat; `relink` asks again. Only the non-secret project configuration is written to `.infisical.yaml`.
 */
export async function setup(relink = false): Promise<number> {
  if (!process.stdin.isTTY) {
    console.error("`pnpm ugur setup` opens the browser and asks questions: run it in your own terminal.");
    return 1;
  }
  for (const [tool, hint] of [
    ["infisical", "winget install infisical.infisical"],
    ["neon", "npm install --global neonctl"],
  ] as const) {
    if (!has(tool)) {
      console.error(`${tool} CLI not found → ${hint}`);
      return 1;
    }
  }

  if (!ensureDedicatedProfile()) return 1;
  if (!(await ensureCloudflareProfile())) return 1;

  if (!infisicalConfig() || relink) {
    step('Choose the organization, then this product\'s project. It must be of type "Secrets Management".');
    const temporaryDirectory = mkdtempSync(join(tmpdir(), "uguroezdamar-infisical-link-"));
    try {
      if (run("infisical", ["init", `--domain=${INFISICAL_DOMAIN}`], {
        cwd: temporaryDirectory,
        env: { INFISICAL_PROFILE },
      }).code !== 0) {
        console.error("Infisical linking was cancelled or failed; the existing repository link was left unchanged.");
        return 1;
      }
      const workspaceId = selectedWorkspaceId(join(temporaryDirectory, ".infisical.yaml"));
      if (!workspaceId) {
        console.error("`infisical init` did not record a valid project; the existing repository link was left unchanged.");
        return 1;
      }
      for (const stage of Object.keys(STAGES) as Stage[]) {
        if (!verifyProjectAccess(workspaceId, stage, temporaryDirectory)) {
          console.error("The repository's existing Infisical link was left unchanged. Select the correct organization and project, then retry.");
          return 1;
        }
      }
      writeInfisicalConfig(workspaceId);
      console.log("✓ Infisical: project access verified for dev and prod; repository link updated");
    } finally {
      removeTemporaryDirectory(temporaryDirectory);
    }
  } else if (!listSecretNames("dev")) {
    if (accessHint().includes("--relink")) {
      console.error(accessHint());
      return 1;
    }
    step(`Sign in to Infisical (${INFISICAL_DOMAIN}) — a browser window opens.`);
    if (run("infisical", ["login", `--domain=${INFISICAL_DOMAIN}`]).code !== 0) return 1;
  } else {
    console.log("✓ Infisical: signed in and linked");
  }

  if (neonLoggedIn()) {
    console.log("✓ Neon: signed in");
  } else {
    step("Sign in to Neon — a browser window opens.");
    if (run("neon", ["auth"]).code !== 0) return 1;
  }

  console.log(`
Next:
  pnpm ugur db provision --apply      Neon project, branches, connection strings → Infisical
  pnpm ugur secrets generate --apply  random signing keys and tokens (dev; add --stage prod)
  pnpm ugur secrets audit             what is still missing
  pnpm ugur db migrate                create the tables
  pnpm ugur admin create <email>      first owner account
  pnpm dev                            run site and portal with secrets injected`);
  return 0;
}
