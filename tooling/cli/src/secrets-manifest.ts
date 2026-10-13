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
  ...required("Postgres pooled (runtime) / direct (migrations)", ["DATABASE_URL", "DATABASE_URL_DIRECT"], {
    managedBy: "pnpm ugur db provision",
  }),
  // Hosted addresses: production in `prod`, the preview deployment in `dev`. A local run never
  // uses them; `localEnv()` in lib/stages.ts replaces them with localhost addresses.
  ...required(
    "Public origin of the site: canonical URLs, sitemap, contact origin check",
    ["NEXT_PUBLIC_SITE_URL"],
  ),
  ...required("Origin of the admin portal, used in invite links", ["APP_URL"]),
  ...required("Site origin as the portal links to it", ["SITE_URL"]),
  ...required(
    "HMAC key for the contact form rate limit (at least 32 characters)",
    ["CONTACT_RATE_LIMIT_SECRET"],
    { random: true },
  ),
  ...required("Bearer token for automated admin API access", ["ADMIN_API_KEY"], { random: true }),

  ...optional("Admin session lifetime in seconds (default 86400)", ["ADMIN_SESSION_TTL_SECONDS"]),
  ...optional("Admin invite lifetime in hours (default 72)", ["ADMIN_INVITE_EXPIRES_HOURS"]),
];

/** Keys that used to exist. `secrets audit` names them so they get removed, not re-declared. */
export const RETIRED: readonly string[] = [
  "MONGODB_URI",
  "TEST_MONGODB_URI",
  "R2_PUBLIC_BASE",
  // The project CMS and its media storage are gone (ADR 0019).
  "REVALIDATE_SECRET",
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
