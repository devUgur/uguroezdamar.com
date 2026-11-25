import { randomBytes } from "node:crypto";
import { has, run } from "../lib/exec.ts";
import { askHidden } from "../lib/prompt.ts";

/**
 * Repository secrets of the agent platform (ADR 0024). They live in GitHub Actions, not in
 * Infisical, because only the deploy workflow reads them and uploads them as Worker secrets.
 * Values are never printed: generated ones go to gh and the clipboard, typed ones come from a
 * hidden prompt.
 */
const REPO = "devUgur/uguroezdamar.com";

interface PlatformSecret {
  name: string;
  required: boolean;
  purpose: string;
  /** How to obtain the value; absent when the CLI generates it. */
  howTo?: string[];
}

const SECRETS: PlatformSecret[] = [
  {
    name: "CLOUDFLARE_API_TOKEN",
    required: true,
    purpose: "Deploy, D1-Migrationen, Custom Domain",
    howTo: ["dash.cloudflare.com/profile/api-tokens – Rechte siehe apps/platform/README.md"],
  },
  { name: "CLOUDFLARE_ACCOUNT_ID", required: true, purpose: "Cloudflare-Konto des Deploys" },
  {
    name: "PLATFORM_ADMIN_TOKEN",
    required: true,
    purpose: "Anmeldung in der Plattform, bis Cloudflare Access davor steht",
  },
  {
    name: "GEMINI_API_KEY",
    required: false,
    purpose: "Gemini als Modell; ohne Schlüssel antwortet Workers AI",
    howTo: ["https://aistudio.google.com/apikey → „Create API key“ → kopieren"],
  },
  {
    name: "AGENT_GITHUB_TOKEN",
    required: false,
    purpose: "Repo lesen, Commits und Pull Requests des Agenten",
    howTo: [
      "https://github.com/settings/personal-access-tokens/new (Fine-grained token)",
      "Name: uguroezdamar-platform, Ablauf: 90 Tage",
      "Repository access: Only select repositories → devUgur/uguroezdamar.com",
      "Permissions: Contents Read and write, Pull requests Read and write, Checks Read-only (Metadata ist automatisch Read-only)",
      "„Generate token“ → kopieren",
    ],
  },
];

function existingNames(): Set<string> | null {
  const result = run("gh", ["secret", "list", "--repo", REPO, "--json", "name", "--jq", ".[].name"], { capture: true });
  if (result.code !== 0) return null;
  return new Set(result.stdout.split(/\r?\n/).filter(Boolean));
}

function setSecret(name: string, value: string): boolean {
  return run("gh", ["secret", "set", name, "--repo", REPO], { capture: true, input: value }).code === 0;
}

function copyToClipboard(value: string): boolean {
  const tool =
    process.platform === "win32" ? ["clip"] : process.platform === "darwin" ? ["pbcopy"] : ["xclip", "-selection", "clipboard"];
  const [command, ...args] = tool as [string, ...string[]];
  return run(command, args, { capture: true, input: value }).code === 0;
}

export async function platformSecrets(apply: boolean, rotate: boolean): Promise<number> {
  if (!has("gh")) {
    console.error("GitHub CLI fehlt: https://cli.github.com, danach `gh auth login`.");
    return 1;
  }
  const existing = existingNames();
  if (!existing) {
    console.error(`Kann die Secrets von ${REPO} nicht lesen. \`gh auth status\` prüfen.`);
    return 1;
  }

  console.log(`Repository-Secrets der Plattform (${REPO}, nur Namen):`);
  for (const secret of SECRETS) {
    const mark = existing.has(secret.name) ? "✓ gesetzt " : secret.required ? "✗ fehlt   " : "– optional";
    console.log(`  ${mark}  ${secret.name.padEnd(22)} ${secret.purpose}`);
  }
  if (!apply) {
    console.log("\nTrockenlauf. Mit --apply erzeugen bzw. abfragen und setzen; --rotate erneuert das Admin-Token.");
    return 0;
  }

  let changed = false;

  if (!existing.has("PLATFORM_ADMIN_TOKEN") || rotate) {
    const token = randomBytes(32).toString("base64url");
    if (!setSecret("PLATFORM_ADMIN_TOKEN", token)) {
      console.error("PLATFORM_ADMIN_TOKEN konnte nicht gesetzt werden.");
      return 1;
    }
    changed = true;
    console.log(
      copyToClipboard(token)
        ? "\nPLATFORM_ADMIN_TOKEN gesetzt und in die Zwischenablage kopiert. Jetzt im Passwortmanager speichern – angezeigt wird es nie."
        : "\nPLATFORM_ADMIN_TOKEN gesetzt, aber die Zwischenablage ging nicht. Mit --rotate erneut erzeugen.",
    );
  }

  for (const secret of SECRETS.filter((entry) => !entry.required && !existing.has(entry.name))) {
    console.log(`\n${secret.name} – ${secret.purpose}`);
    for (const line of secret.howTo ?? []) console.log(`  · ${line}`);
    const value = await askHidden("Wert einfügen (leer = überspringen): ");
    if (value === null) {
      console.error("Kein interaktives Terminal; übersprungen.");
      continue;
    }
    if (!value) continue;
    if (!setSecret(secret.name, value)) {
      console.error(`${secret.name} konnte nicht gesetzt werden.`);
      return 1;
    }
    changed = true;
    console.log(`${secret.name} gesetzt.`);
  }

  const missingRequired = SECRETS.filter((entry) => entry.required && !existing.has(entry.name) && entry.name !== "PLATFORM_ADMIN_TOKEN");
  for (const secret of missingRequired) {
    console.error(`\n${secret.name} fehlt noch: ${secret.howTo?.join(" ") ?? "im Repository anlegen"}`);
  }

  if (changed && !missingRequired.length) {
    // Worker secrets only change on a deploy; dev deploys without approval, production only via main.
    const started = run("gh", ["workflow", "run", "platform-deploy.yml", "--repo", REPO, "--ref", "dev"], { capture: true });
    console.log(
      started.code === 0
        ? "\nDev-Deploy gestartet: https://platform-dev.uguroezdamar.com (in 2–3 Minuten). Produktion übernimmt die Werte beim nächsten Merge auf main."
        : "\nDev-Deploy nicht gestartet; in GitHub Actions „Platform deploy“ auf dev manuell starten.",
    );
  }
  return missingRequired.length ? 1 : 0;
}
