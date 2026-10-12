import { has } from "../lib/exec.ts";
import { infisicalConfig, INFISICAL_DOMAIN, listSecretNames } from "../lib/infisical.ts";
import { neonLoggedIn } from "../lib/neon.ts";
import type { Stage } from "../lib/stages.ts";
import { secretsFor } from "../secrets-manifest.ts";

type Check = { name: string; ok: boolean; hint?: string };

function toolChecks(): Check[] {
  const [major] = process.versions.node.split(".").map(Number);
  const neon = has("neon");
  return [
    { name: "Node.js >= 24", ok: (major ?? 0) >= 24, hint: "Install Node 24." },
    { name: "Infisical CLI", ok: has("infisical"), hint: "winget install infisical.infisical" },
    { name: "Neon CLI", ok: neon, hint: "npm install --global neonctl" },
    { name: "Neon signed in (only needed for `db provision`)", ok: neon && neonLoggedIn(), hint: "neon auth" },
    { name: "Linked to an Infisical project", ok: infisicalConfig() !== null, hint: "pnpm ugur setup" },
  ];
}

function secretChecks(stage: Stage): Check[] {
  if (!infisicalConfig()) return [];
  const names = listSecretNames(stage);
  if (!names) {
    return [{ name: `Infisical (${stage})`, ok: false, hint: `infisical login --domain=${INFISICAL_DOMAIN}` }];
  }
  return secretsFor(stage)
    .filter((spec) => !spec.optional)
    .map((spec) => ({
      name: `secret ${spec.key} (${stage})`,
      ok: names.filled.includes(spec.key),
      hint: spec.managedBy
        ? `${spec.managedBy} --apply`
        : spec.random
          ? `pnpm ugur secrets generate --stage ${stage} --apply`
          : `pnpm ugur secrets set ${spec.key} — ${spec.purpose}`,
    }));
}

export function doctor(stage: Stage): number {
  const checks = [...toolChecks(), ...secretChecks(stage)];
  for (const check of checks) {
    console.log(`${check.ok ? "✓" : "✗"} ${check.name}${check.ok ? "" : `  → ${check.hint}`}`);
  }
  const failed = checks.filter((check) => !check.ok).length;
  console.log(failed ? `\n${failed} check(s) failed.` : "\nAll good.");
  return failed ? 1 : 0;
}
