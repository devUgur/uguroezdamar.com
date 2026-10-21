import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { isAbsolute, join, relative, resolve } from "node:path";
import { has, run } from "../lib/exec.ts";
import {
  accessHint,
  INFISICAL_DOMAIN,
  infisicalConfig,
  listSecretNames,
  writeInfisicalConfig,
} from "../lib/infisical.ts";
import { neonLoggedIn } from "../lib/neon.ts";
import { STAGES, type Stage } from "../lib/stages.ts";

const step = (text: string) => console.log(`\n▸ ${text}`);

function selectedWorkspaceId(path: string): string | null {
  try {
    const value = JSON.parse(readFileSync(path, "utf8")) as { workspaceId?: unknown };
    return typeof value.workspaceId === "string" && /^[0-9a-f-]{36}$/i.test(value.workspaceId) ? value.workspaceId : null;
  } catch {
    return null;
  }
}

function verifyProjectAccess(workspaceId: string, stage: Stage, cwd: string): boolean {
  const result = run(
    "infisical",
    ["export", "--env", STAGES[stage].infisical, "--projectId", workspaceId, "--domain", INFISICAL_DOMAIN, "--path", "/", "--format", "json", "--silent"],
    { cwd, capture: true },
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

/**
 * One-time onboarding of a machine: sign in to Infisical and Neon in the browser and link this
 * checkout to its Infisical project. Every step is skipped when it is already done, so the
 * command is safe to repeat; `relink` forgets the linked project and asks again. Nothing is written to disk except `.infisical.json` (a project id).
 */
export function setup(relink = false): number {
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

  if (!infisicalConfig() || relink) {
    // `init` lists nothing without a session; an existing one is reused.
    if (!relink) {
      step(`Sign in to Infisical (${INFISICAL_DOMAIN}) — a browser window opens.`);
      if (run("infisical", ["login", `--domain=${INFISICAL_DOMAIN}`]).code !== 0) return 1;
    }

    step('Choose the organization, then this product\'s project. It must be of type "Secrets Management".');
    const temporaryDirectory = mkdtempSync(join(tmpdir(), "uguroezdamar-infisical-link-"));
    try {
      if (run("infisical", ["init", `--domain=${INFISICAL_DOMAIN}`], { cwd: temporaryDirectory }).code !== 0) {
        console.error("Infisical linking was cancelled or failed; the existing repository link was left unchanged.");
        return 1;
      }
      const workspaceId = selectedWorkspaceId(join(temporaryDirectory, ".infisical.json"));
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
