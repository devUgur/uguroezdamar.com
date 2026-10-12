import { existsSync, readFileSync, rmSync } from "node:fs";
import { has, run } from "../lib/exec.ts";
import {
  accessHint,
  INFISICAL_DOMAIN,
  INFISICAL_FILE,
  infisicalConfig,
  listSecretNames,
  writeInfisicalConfig,
} from "../lib/infisical.ts";
import { neonLoggedIn } from "../lib/neon.ts";

const step = (text: string) => console.log(`\n▸ ${text}`);

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

  if (relink && existsSync(INFISICAL_FILE)) rmSync(INFISICAL_FILE);

  if (!infisicalConfig()) {
    // `init` lists nothing without a session; an existing one is reused.
    if (!relink) {
      step(`Sign in to Infisical (${INFISICAL_DOMAIN}) — a browser window opens.`);
      if (run("infisical", ["login", `--domain=${INFISICAL_DOMAIN}`]).code !== 0) return 1;
    }

    step('Choose the organization, then this product\'s project. It must be of type "Secrets Management".');
    if (run("infisical", ["init", `--domain=${INFISICAL_DOMAIN}`]).code !== 0) return 1;
    const { workspaceId } = JSON.parse(readFileSync(INFISICAL_FILE, "utf8")) as { workspaceId?: string };
    if (!workspaceId) {
      console.error("`infisical init` did not record a project.");
      return 1;
    }
    writeInfisicalConfig(workspaceId);
    if (!listSecretNames("dev") || !listSecretNames("prod")) {
      console.error(`\n✗ The chosen project cannot hold this product's secrets.\n${accessHint()}`);
      return 1;
    }
    console.log("✓ .infisical.json written — commit it; it holds a project id, no secret.");
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
