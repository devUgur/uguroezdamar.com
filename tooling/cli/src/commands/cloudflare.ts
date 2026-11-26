import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { REPO_ROOT, run } from "../lib/exec.ts";

/**
 * Cloudflare access of this checkout. Wrangler keeps one global login by default; on this machine that login belongs
 * to another product (ViralSync), and resources once ended up in the wrong account. A named Wrangler profile bound
 * to this repository keeps the two apart: inside this checkout Wrangler speaks to uguroezdamar's account, elsewhere
 * the global login stays as it is. Every command checks the account before it reports success.
 */
const PROFILE = "uguroezdamar";
const API_DIR = resolve(REPO_ROOT, "apps/api");

/** The account the API deploys to, from apps/api/wrangler.jsonc (CF_ACCOUNT_ID). */
export function expectedAccountId(): string {
  const config = readFileSync(resolve(API_DIR, "wrangler.jsonc"), "utf8");
  const id = config.match(/"CF_ACCOUNT_ID":\s*"([0-9a-f]{32})"/)?.[1];
  if (!id) throw new Error("CF_ACCOUNT_ID fehlt in apps/api/wrangler.jsonc.");
  return id;
}

/** The project's Wrangler (apps/api), not a global one of another version. */
function wrangler(args: string[], capture = false) {
  return run("pnpm", ["exec", "wrangler", ...args], { cwd: API_DIR, capture });
}

function check(): boolean {
  const account = expectedAccountId();
  const identity = wrangler(["whoami"], true);
  const output = `${identity.stdout}\n${identity.stderr}`;
  if (identity.code !== 0 || /not authenticated/i.test(output)) {
    console.error("Wrangler ist in diesem Checkout nicht angemeldet. Anmelden: pnpm ugur cf login");
    return false;
  }
  if (!output.includes(account)) {
    console.error(`Wrangler ist hier mit einem anderen Cloudflare-Konto angemeldet, nicht mit uguroezdamar (${account.slice(0, 8)}…).`);
    console.error("Nichts ausführen. Neu anmelden: pnpm ugur cf login (im Browser das Konto von uguroezdamar.com wählen).");
    return false;
  }
  console.log(`✓ Cloudflare: Konto ${account.slice(0, 8)}… (uguroezdamar), Profil '${PROFILE}' an ${REPO_ROOT} gebunden.`);
  return true;
}

export function cloudflare(sub: string | undefined): number {
  if (Reflect.get(process.env, "CLOUDFLARE_API_TOKEN")) {
    console.error("CLOUDFLARE_API_TOKEN ist gesetzt und überschreibt jede Wrangler-Anmeldung. Für diesen Befehl die Variable entfernen.");
    return 1;
  }
  if (sub === "whoami") return check() ? 0 : 1;
  if (sub === "login") {
    console.log("Im Browser mit dem Cloudflare-Konto von uguroezdamar.com anmelden (nicht ViralSync).");
    // Without --scopes Wrangler asks for its usual set: Workers, D1, KV, Pages, Queues, AI, Containers.
    if (wrangler(["auth", "create", PROFILE]).code !== 0) {
      console.error("Anmeldung abgebrochen oder fehlgeschlagen.");
      return 1;
    }
    if (wrangler(["auth", "activate", PROFILE, REPO_ROOT]).code !== 0) {
      console.error(`Profil '${PROFILE}' ließ sich nicht an ${REPO_ROOT} binden.`);
      return 1;
    }
    if (!check()) {
      // A wrong account must not stay bound to this checkout.
      wrangler(["auth", "deactivate", REPO_ROOT]);
      return 1;
    }
    console.log("Die globale Wrangler-Anmeldung (z. B. ViralSync) bleibt unverändert; sie gilt nur außerhalb dieses Repositories.");
    return 0;
  }
  console.error("pnpm ugur cf login | whoami");
  return 1;
}
