/**
 * The one table that maps a stage to every system's own name for it.
 * Everything else (CLI flags, CI, docs) refers to stages only.
 *
 * Two stages on purpose: `dev` covers local runs and every preview, `prod` is `main`.
 */
export const STAGES = {
  dev: { branch: "dev", infisical: "dev", neon: "dev" },
  prod: { branch: "main", infisical: "prod", neon: "prod" },
} as const;

export type Stage = keyof typeof STAGES;

export function parseStage(value: string | undefined, fallback: Stage = "dev"): Stage {
  const stage = value ?? fallback;
  if (!(stage in STAGES)) {
    throw new Error(`Unknown stage "${stage}". Use one of: ${Object.keys(STAGES).join(", ")}.`);
  }
  return stage as Stage;
}

/**
 * How the apps address themselves on a developer's machine; never stored in Infisical.
 * Ports 3100/3101 stay clear of viralsync.io, which uses 3000 and up on the same machine.
 */
export const LOCAL_ORIGINS = {
  site: "http://localhost:3100",
  portal: "http://localhost:3101",
} as const;

/** The address variables of a local run, replacing the hosted values of the `dev` stage. */
export function localEnv(): Record<string, string> {
  return {
    NEXT_PUBLIC_SITE_URL: LOCAL_ORIGINS.site,
    APP_URL: LOCAL_ORIGINS.portal,
  };
}
