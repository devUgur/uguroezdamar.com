/**
 * The operating mode of the Node host (ADR 0045, decision 7), chosen and checked in one place at start. Every other
 * file takes what this returns; no file reads the environment for a provider choice on its own.
 *
 * - local: development on this machine. PGlite unless a database URL is given, bound to 127.0.0.1, no Cloudflare.
 * - cloud-dev: a local host with chosen cloud services (e.g. the Neon dev branch); a database URL is required.
 * - cloud: a hosted Node host (Docker, Northflank, Railway). Database URL required, listens on all interfaces.
 */
export type Mode = "local" | "cloud-dev" | "cloud";

export interface HostConfig {
  mode: Mode;
  port: number;
  bind: string;
  dataDir: string;
  databaseUrl: string | null;
  apiEnv: string;
  /** How often the database is swept for jobs of another host (ms). */
  sweepMs: number;
}

export class ConfigError extends Error {}

export function hostConfig(env: Record<string, string | undefined>, defaults: { dataDir: string }): HostConfig {
  const mode = (env.NODE_HOST_MODE ?? "local") as Mode;
  if (!["local", "cloud-dev", "cloud"].includes(mode)) throw new ConfigError(`NODE_HOST_MODE "${mode}" ist unbekannt (local, cloud-dev, cloud).`);
  const port = Number(env.NODE_HOST_PORT ?? 3103);
  if (!Number.isInteger(port) || port <= 0 || port > 65_535) throw new ConfigError(`NODE_HOST_PORT "${env.NODE_HOST_PORT}" ist kein Port.`);
  const databaseUrl = env.NODE_HOST_DATABASE_URL?.trim() || null;
  if (mode !== "local" && !databaseUrl) throw new ConfigError(`NODE_HOST_MODE=${mode} braucht NODE_HOST_DATABASE_URL (Postgres); PGlite ist nur für local.`);
  if (databaseUrl && !/^postgres(ql)?:\/\//.test(databaseUrl)) throw new ConfigError("NODE_HOST_DATABASE_URL muss mit postgres:// beginnen.");
  if (!env.API_SERVICE_TOKEN) throw new ConfigError("API_SERVICE_TOKEN fehlt: Portal und Office könnten sich nicht anmelden.");
  if (mode === "cloud" && env.API_SERVICE_TOKEN.length < 32) throw new ConfigError("API_SERVICE_TOKEN ist für einen gehosteten Betrieb zu kurz (mindestens 32 Zeichen).");
  // A key made inside a container would be gone after the next deploy, and with it every stored model key.
  if (mode === "cloud" && !env.PROVIDER_KEYS_SECRET) throw new ConfigError("PROVIDER_KEYS_SECRET fehlt: ohne festen Schlüssel wären die im Portal hinterlegten Modellschlüssel nach dem nächsten Neustart unlesbar.");
  const sweepMs = Number(env.NODE_HOST_SWEEP_MS ?? 30 * 60_000);
  if (!Number.isFinite(sweepMs) || sweepMs < 10_000) throw new ConfigError("NODE_HOST_SWEEP_MS muss mindestens 10000 sein.");
  return {
    mode,
    port,
    bind: env.NODE_HOST_BIND ?? (mode === "cloud" ? "0.0.0.0" : "127.0.0.1"),
    dataDir: env.NODE_HOST_DATA ?? defaults.dataDir,
    databaseUrl,
    apiEnv: env.NODE_HOST_ENV ?? mode,
    sweepMs,
  };
}

/** One line for the log: which provider serves which port. Never prints a value of a secret. */
export function describe(config: HostConfig): string {
  const database = config.databaseUrl ? `Postgres (${new URL(config.databaseUrl).host})` : "PGlite";
  return `Betriebsart ${config.mode}: Datenbank ${database}, Aufträge per Timer und Durchgang alle ${Math.round(config.sweepMs / 60_000)} min, Live im Prozess, Dateien und Actors in ${config.dataDir}, Modelle direkt beim Anbieter, kein Cloudflare`;
}
