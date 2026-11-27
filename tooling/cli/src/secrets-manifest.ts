import type { Stage } from "./lib/stages.ts";

export interface SecretSpec {
  key: string;
  purpose: string;
  /** Limit a key to some stages; default is every stage. */
  stages?: readonly Stage[];
  /** The feature stays disabled until the key is set; it does not block dev or deploys. */
  optional?: boolean;
  /** Written by a CLI command rather than typed by a person. */
  managedBy?: string;
  /** A random value of our own making; `secrets generate` can create it. */
  random?: boolean;
  /** Only the CLI reads it, straight from Infisical: no task needs it in its environment, so turbo does not pass it on. */
  cliOnly?: boolean;
  /** The apps that read the key at runtime or build time; `hosting env` syncs it to those. */
  apps?: readonly ("site" | "portal")[];
}

const required = (purpose: string, keys: string[], extra: Partial<SecretSpec> = {}): SecretSpec[] =>
  keys.map((key) => ({ key, purpose, ...extra }));

const optional = (purpose: string, keys: string[], extra: Partial<SecretSpec> = {}): SecretSpec[] =>
  keys.map((key) => ({ key, purpose, optional: true, ...extra }));

/**
 * Every environment variable the product reads. Adding a key here is the only way to
 * introduce one; `pnpm ugur secrets audit` reports keys in Infisical that are not listed.
 */
export const SECRETS: readonly SecretSpec[] = [
  ...required("Postgres, pooled: what the apps connect with", ["DATABASE_URL"], {
    managedBy: "pnpm ugur db provision",
    apps: ["site", "portal"],
  }),
  // Migrations only. No app reads it, so it is never synced to the host.
  ...required("Postgres, direct: migrations", ["DATABASE_URL_DIRECT"], { managedBy: "pnpm ugur db provision" }),
  // Hosted addresses exist in `prod` only. A preview deployment takes its address from Vercel
  // (`VERCEL_URL`), and a local run gets localhost addresses from `localEnv()` in lib/stages.ts.
  ...required(
    "Public origin of the site: canonical URLs, sitemap, contact origin check",
    ["NEXT_PUBLIC_SITE_URL"],
    { stages: ["prod"], apps: ["site"] },
  ),
  ...required("Origin of the admin portal, used in invite links", ["APP_URL"], { stages: ["prod"], apps: ["portal"] }),
  ...required(
    "HMAC key for the contact form rate limit (at least 32 characters)",
    ["CONTACT_RATE_LIMIT_SECRET"],
    { random: true, apps: ["site"] },
  ),
  ...required("Bearer token for the daily contact-request retention job", ["CRON_SECRET"], {
    stages: ["prod"],
    random: true,
    apps: ["site"],
  }),
  ...required("Bearer token for automated admin API access", ["ADMIN_API_KEY"], { random: true, apps: ["portal"] }),

  ...optional("Admin session lifetime in seconds (default 86400)", ["ADMIN_SESSION_TTL_SECONDS"], { apps: ["portal"] }),
  ...optional("Admin invite lifetime in hours (default 72)", ["ADMIN_INVITE_EXPIRES_HOURS"], { apps: ["portal"] }),
  ...optional(
    "Vercel protection bypass per project, so `pnpm ugur smoke` can reach protected previews",
    ["VERCEL_BYPASS_SITE", "VERCEL_BYPASS_PORTAL"],
    { stages: ["dev"] },
  ),
  // Settings of a local run with the Node host (ADR 0045); never stored anywhere, defaults in apps/node-host/src/main.ts.
  ...optional("Node host: port, bind address, data folder and API_ENV label (defaults 3103, 127.0.0.1, apps/node-host/.data, local)", ["NODE_HOST_PORT", "NODE_HOST_BIND", "NODE_HOST_DATA", "NODE_HOST_ENV"], { stages: ["dev"] }),
  ...optional("Node host: operating mode local, cloud-dev or cloud, checked at start (ADR 0045)", ["NODE_HOST_MODE"], { stages: ["dev"] }),
  ...optional("Node host: sweep for jobs of another host in ms (default 30 minutes; lets Neon scale to zero)", ["NODE_HOST_SWEEP_MS"], { stages: ["dev"] }),
  ...optional("Origin of the agent API as the browser reaches it (live WebSocket), when it differs from API_URL (Docker)", ["API_PUBLIC_URL"], { apps: ["portal"] }),
  ...optional("Node host: the API's Postgres (Docker or Neon); without it PGlite in the data folder (ADR 0045, R2)", ["NODE_HOST_DATABASE_URL"], { stages: ["dev"] }),
  ...optional("Local runs: `dev` points portal and office at api-dev on Cloudflare instead of the local Node host", ["UGUR_API"], { stages: ["dev"], cliOnly: true }),
  // The portal's agent chat talks to apps/api (ADR 0024). Dev points at api-dev, prod at api; each
  // stage has its own token, which the API reads from its GitHub environment (api-dev, api-production).
  ...required("Origin of the agent API the portal chat talks to", ["API_URL"], {
    managedBy: "pnpm ugur api secrets",
    apps: ["portal"],
  }),
  ...required("Service token the portal server sends to the agent API (one per stage)", ["API_SERVICE_TOKEN"], {
    managedBy: "pnpm ugur api secrets",
    apps: ["portal"],
  }),
  // Portal and office find each other (ADR 0039). Both have defaults per stage in the code (portal: VERCEL_ENV,
  // office: wrangler vars); a local run sets the localhost addresses. Set only to override.
  ...optional("Origin of the office app the portal links to and signs in for (default by stage)", ["OFFICE_URL"], { apps: ["portal"] }),
  ...optional("Origin of the portal the office signs in through (wrangler vars per stage)", ["PORTAL_URL"], { cliOnly: true }),
  // GitHub App of the agent API (ADR 0031). Infisical holds the values (paste the whole .pem into the web
  // interface, multi-line is fine); `pnpm ugur api secrets` copies them into GitHub Actions, because the API is
  // deployed from there. One app serves both stages, so the values live in `prod` only and are never synced to a host.
  ...optional("GitHub App of the agents: App ID", ["AGENT_GH_APP_ID"], { stages: ["prod"], cliOnly: true }),
  ...optional("GitHub App of the agents: private key (PEM), copied to GitHub Actions", ["AGENT_GH_APP_PRIVATE_KEY"], { stages: ["prod"], cliOnly: true }),
  // Generated by `pnpm ugur api secrets`; the same value goes into the app's webhook settings on GitHub.
  ...optional("GitHub App webhook secret: signs deliveries, copied to GitHub Actions", ["AGENT_GH_WEBHOOK_SECRET"], {
    stages: ["prod"],
    cliOnly: true,
    random: true,
    managedBy: "pnpm ugur api secrets",
  }),
  // Cloudflare token for preview uploads of the workstations (ADR 0036). The Worker adds it to wrangler's calls
  // for one preview Worker; the container never holds it. Copied to GitHub Actions like the GitHub App values.
  ...optional("Agent API: Cloudflare token for preview uploads (Workers Scripts: Edit), copied to GitHub Actions", ["AGENT_CF_PREVIEW_TOKEN"], {
    stages: ["prod"],
    cliOnly: true,
    managedBy: "pnpm ugur api secrets",
  }),
  // Read-only Cloudflare token for the usage view (docs/operations/cloudflare-usage.md): Account Analytics: Read.
  ...optional("Agent API: Cloudflare token for usage analytics (Account Analytics: Read), copied to GitHub Actions", ["CF_ANALYTICS_TOKEN"], {
    stages: ["prod"],
    cliOnly: true,
    managedBy: "pnpm ugur api secrets",
  }),
  // Generated by `pnpm ugur api secrets`; encrypts the model keys tenants enter in the portal (ADR 0033).
  // Never rotated by the command: a new value makes every stored key unreadable.
  ...optional("Agent API: encryption of model keys entered in the portal, copied to GitHub Actions", ["PROVIDER_KEYS_SECRET"], {
    stages: ["prod"],
    cliOnly: true,
    random: true,
    managedBy: "pnpm ugur api secrets",
  }),
];

/** Keys that used to exist. `secrets audit` names them so they get removed, not re-declared. */
export const RETIRED: readonly string[] = [
  // Replaced by API_SERVICE_TOKEN when the chat moved into the portal (ADR 0024).
  "PLATFORM_ADMIN_TOKEN",
  "MONGODB_URI",
  "TEST_MONGODB_URI",
  "R2_PUBLIC_BASE",
  // The project CMS and its media storage are gone (ADR 0019).
  "REVALIDATE_SECRET",
  // No code ever read it.
  "SITE_URL",
  "R2_ACCOUNT_ID",
  "R2_ACCESS_KEY_ID",
  "R2_SECRET_ACCESS_KEY",
  "R2_BUCKET",
  "R2_PUBLIC_BASE_URL",
  "R2_ENDPOINT",
  "R2_REGION",
  "R2_FORCE_PATH_STYLE",
  "PREVIEW_USE_STORAGE",
  "SCREENSHOT_PROVIDER_URL",
  "SCREENSHOT_API_KEY",
];

export const isRetired = (key: string) => RETIRED.includes(key);

export function secretsFor(stage: Stage): SecretSpec[] {
  return SECRETS.filter((spec) => !spec.stages || spec.stages.includes(stage));
}
