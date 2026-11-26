import { randomBytes } from "node:crypto";
import { has, run } from "../lib/exec.ts";
import { listSecretNames, secretValues, setSecret as setInfisicalSecret } from "../lib/infisical.ts";
import { askHidden } from "../lib/prompt.ts";
import type { Stage } from "../lib/stages.ts";

/**
 * Secrets of the agent API (apps/api, ADR 0024). The API reads its secrets from GitHub Actions,
 * which the deploy uploads as Worker secrets; the portal reads API_URL and API_SERVICE_TOKEN from
 * Infisical. Each stage has its own service token, set on both sides by this command. Values are
 * never printed: generated ones go straight to gh and Infisical, typed ones come from a hidden prompt.
 */
const REPO = "devUgur/uguroezdamar.com";

const STAGE_TARGETS: Record<Stage, { environment: string; url: string }> = {
  dev: { environment: "api-dev", url: "https://api-dev.uguroezdamar.com" },
  prod: { environment: "api-production", url: "https://api.uguroezdamar.com" },
};

interface RepoSecret {
  name: string;
  required: boolean;
  purpose: string;
  howTo?: string[];
  /** Kept in Infisical (prod) and copied to GitHub from there, never typed into this command. */
  fromInfisical?: boolean;
}

const REPO_SECRETS: RepoSecret[] = [
  {
    name: "CLOUDFLARE_API_TOKEN",
    required: true,
    purpose: "Deploy, D1-Migrationen, Custom Domain",
    howTo: ["dash.cloudflare.com/profile/api-tokens – Rechte siehe apps/api/README.md"],
  },
  { name: "CLOUDFLARE_ACCOUNT_ID", required: true, purpose: "Cloudflare-Konto des Deploys" },
  {
    name: "GEMINI_API_KEY",
    required: false,
    purpose: "Gemini als Modell; ohne Schlüssel antwortet Workers AI",
    howTo: ["https://aistudio.google.com/apikey → „Create API key“ → kopieren"],
  },
  {
    name: "MODAL_LLM_API_KEY",
    required: false,
    purpose: "Eigene Modelle auf Modal (apps/api/modal/llm.py); gleicher Wert wie Modal-Secret uguroezdamar-llm",
    howTo: ["Wird beim Einrichten von Modal erzeugt (apps/api/README.md, Abschnitt Modal); nicht von Hand eintippen."],
  },
  {
    name: "AGENT_GH_APP_ID",
    required: false,
    fromInfisical: true,
    purpose: "GitHub App der Agenten (ADR 0031): App ID",
    howTo: ["github.com/settings/apps → die App → „About“ → App ID (nur Ziffern)"],
  },
  {
    name: "AGENT_GH_APP_PRIVATE_KEY",
    required: false,
    fromInfisical: true,
    purpose: "GitHub App der Agenten: privater Schlüssel",
    howTo: ["Auf der App-Seite „Generate a private key“; die .pem-Datei wird heruntergeladen"],
  },
  {
    name: "AGENT_GITHUB_TOKEN",
    required: false,
    purpose: "Repo lesen, Commits und Pull Requests des Agenten",
    howTo: [
      "https://github.com/settings/personal-access-tokens/new (Fine-grained token)",
      "Name: uguroezdamar-agents, Ablauf: 90 Tage",
      "Repository access: Only select repositories → devUgur/uguroezdamar.com",
      "Permissions: Contents Read and write, Pull requests Read and write, Checks Read-only (Metadata ist automatisch Read-only)",
      "„Generate token“ → kopieren",
    ],
  },
];

function names(args: string[]): Set<string> | null {
  const result = run("gh", ["secret", "list", "--repo", REPO, ...args, "--json", "name", "--jq", ".[].name"], { capture: true });
  if (result.code !== 0) return null;
  return new Set(result.stdout.split(/\r?\n/).filter(Boolean));
}

function setGhSecret(name: string, value: string, environment?: string): boolean {
  const args = ["secret", "set", name, "--repo", REPO, ...(environment ? ["--env", environment] : [])];
  return run("gh", args, { capture: true, input: value }).code === 0;
}

function ensureEnvironment(environment: string): boolean {
  return run("gh", ["api", "--method", "PUT", `repos/${REPO}/environments/${environment}`, "--silent"], { capture: true }).code === 0;
}

export async function apiSecrets(apply: boolean, rotate: boolean): Promise<number> {
  if (!has("gh")) {
    console.error("GitHub CLI fehlt: https://cli.github.com, danach `gh auth login`.");
    return 1;
  }
  const repo = names([]);
  if (!repo) {
    console.error(`Kann die Secrets von ${REPO} nicht lesen. \`gh auth status\` prüfen.`);
    return 1;
  }

  console.log(`Agenten-API: Secrets (nur Namen)\n\nGitHub-Repository ${REPO}:`);
  for (const secret of REPO_SECRETS) {
    const mark = repo.has(secret.name) ? "✓ gesetzt " : secret.required ? "✗ fehlt   " : "– optional";
    console.log(`  ${mark}  ${secret.name.padEnd(22)} ${secret.purpose}`);
  }

  const stages = Object.keys(STAGE_TARGETS) as Stage[];
  const state = stages.map((stage) => {
    const target = STAGE_TARGETS[stage];
    const github = names(["--env", target.environment]);
    const infisical = listSecretNames(stage);
    return {
      stage,
      target,
      githubToken: github?.has("API_SERVICE_TOKEN") ?? false,
      infisicalToken: infisical?.filled.includes("API_SERVICE_TOKEN") ?? false,
      infisicalUrl: infisical?.filled.includes("API_URL") ?? false,
      infisicalReadable: infisical !== null,
    };
  });
  console.log("\nService-Token und Adresse je Stage (GitHub-Environment ↔ Infisical):");
  for (const entry of state) {
    const mark = (ok: boolean) => (ok ? "✓" : "✗");
    console.log(
      `  ${entry.stage.padEnd(4)} ${entry.target.environment.padEnd(15)} API_SERVICE_TOKEN GitHub ${mark(entry.githubToken)} Infisical ${mark(entry.infisicalToken)}   API_URL ${mark(entry.infisicalUrl)} ${entry.target.url}`,
    );
  }

  if (!apply) {
    console.log("\nTrockenlauf. Mit --apply fehlende Werte erzeugen bzw. abfragen und setzen; --rotate erneuert beide Service-Tokens.");
    return 0;
  }

  let changedDev = false;
  for (const entry of state) {
    if (!entry.infisicalReadable) {
      console.error(`\nInfisical (${entry.stage}) nicht lesbar – \`pnpm ugur setup\`. Übersprungen.`);
      continue;
    }
    if (!entry.infisicalUrl && setInfisicalSecret(entry.stage, "API_URL", entry.target.url).ok) {
      console.log(`\nAPI_URL in Infisical ${entry.stage} gesetzt (${entry.target.url}).`);
    }
    if (entry.githubToken && entry.infisicalToken && !rotate) continue;
    // Both sides must hold the same value, so a token missing on either side is replaced on both.
    const token = randomBytes(32).toString("base64url");
    if (!ensureEnvironment(entry.target.environment) || !setGhSecret("API_SERVICE_TOKEN", token, entry.target.environment)) {
      console.error(`API_SERVICE_TOKEN für ${entry.target.environment} konnte nicht in GitHub gesetzt werden.`);
      return 1;
    }
    if (!setInfisicalSecret(entry.stage, "API_SERVICE_TOKEN", token).ok) {
      console.error(`API_SERVICE_TOKEN konnte nicht in Infisical ${entry.stage} gesetzt werden; GitHub hat bereits den neuen Wert. Erneut mit --rotate ausführen.`);
      return 1;
    }
    console.log(`\nAPI_SERVICE_TOKEN neu für ${entry.stage} (GitHub-Environment ${entry.target.environment} und Infisical ${entry.stage}).`);
    if (entry.stage === "dev") changedDev = true;
  }

  // The GitHub App: Infisical (prod) is the source of truth, GitHub Actions gets a copy for the deploy.
  const appNames = REPO_SECRETS.filter((entry) => entry.fromInfisical).map((entry) => entry.name);
  const appValues = secretValues("prod", appNames);
  if (appValues) {
    for (const name of appNames) {
      if (repo.has(name) && !rotate) continue;
      if (!setGhSecret(name, appValues[name] ?? "")) {
        console.error(`${name} konnte nicht von Infisical nach GitHub kopiert werden.`);
        return 1;
      }
      changedDev = true;
      console.log(`\n${name}: aus Infisical (prod) nach GitHub kopiert.`);
    }
  } else if (appNames.some((name) => !repo.has(name))) {
    console.log("\nGitHub App (ADR 0031): AGENT_GH_APP_ID und AGENT_GH_APP_PRIVATE_KEY fehlen in Infisical (prod).");
    console.log("  · Im Infisical-Web (Projekt, Environment prod) beide als Secret anlegen: die App ID (Ziffern) und den kompletten Inhalt der .pem-Datei (mehrzeilig einfügen).");
    console.log("  · Danach diesen Befehl erneut ausführen; er kopiert die Werte nach GitHub. Die .pem-Datei danach löschen.");
  }

  for (const secret of REPO_SECRETS.filter((entry) => !entry.required && !entry.fromInfisical && !repo.has(entry.name))) {
    console.log(`\n${secret.name} – ${secret.purpose}`);
    for (const line of secret.howTo ?? []) console.log(`  · ${line}`);
    const value = await askHidden("Wert einfügen (leer = überspringen): ");
    if (value === null) {
      console.log("Kein interaktives Terminal; übersprungen.");
      continue;
    }
    if (!value) continue;
    if (!setGhSecret(secret.name, value)) {
      console.error(`${secret.name} konnte nicht gesetzt werden.`);
      return 1;
    }
    changedDev = true;
    console.log(`${secret.name} gesetzt.`);
  }

  const missingRequired = REPO_SECRETS.filter((entry) => entry.required && !repo.has(entry.name));
  for (const secret of missingRequired) console.error(`\n${secret.name} fehlt noch: ${secret.howTo?.join(" ") ?? "im Repository anlegen"}`);

  console.log("\nDas Portal liest API_URL und API_SERVICE_TOKEN aus Infisical. Für Vercel danach: pnpm ugur hosting env --stage dev --apply (Preview) bzw. --stage prod.");
  if (changedDev && !missingRequired.length) {
    // Worker secrets only change on a deploy; dev deploys without approval, production only via main.
    const started = run("gh", ["workflow", "run", "api-deploy.yml", "--repo", REPO, "--ref", "dev"], { capture: true });
    console.log(
      started.code === 0
        ? "Dev-Deploy der API gestartet (api-dev.uguroezdamar.com, 2–3 Minuten). Produktion übernimmt die Werte beim nächsten Merge auf main."
        : "Dev-Deploy nicht gestartet; in GitHub Actions „API deploy“ auf dev manuell starten.",
    );
  }
  return missingRequired.length ? 1 : 0;
}
