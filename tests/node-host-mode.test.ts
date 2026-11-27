import { describe, expect, it } from "vitest";
import { ConfigError, describe as describeConfig, hostConfig } from "../apps/node-host/src/mode.ts";

/** ADR 0045, decision 7: the Node host's mode is chosen and checked in one place at start. */
const TOKEN = "a".repeat(40);
const defaults = { dataDir: "/data" };

describe("node host mode", () => {
  it("runs locally on PGlite and this machine only by default", () => {
    const config = hostConfig({ API_SERVICE_TOKEN: "short" }, defaults);
    expect(config).toMatchObject({ mode: "local", port: 3103, bind: "127.0.0.1", databaseUrl: null, apiEnv: "local" });
    expect(describeConfig(config)).toContain("PGlite");
  });

  it("needs Postgres and a long token outside local, and listens on all interfaces in the cloud", () => {
    expect(() => hostConfig({ NODE_HOST_MODE: "cloud", API_SERVICE_TOKEN: TOKEN }, defaults)).toThrow(ConfigError);
    expect(() => hostConfig({ NODE_HOST_MODE: "cloud", API_SERVICE_TOKEN: "short", NODE_HOST_DATABASE_URL: "postgres://db/agents" }, defaults)).toThrow(/zu kurz/);
    const base = { NODE_HOST_MODE: "cloud", API_SERVICE_TOKEN: TOKEN, NODE_HOST_DATABASE_URL: "postgres://user:secret@db:5432/agents" };
    // Model keys stored in the portal would be unreadable after a restart with a generated key.
    expect(() => hostConfig(base, defaults)).toThrow(/PROVIDER_KEYS_SECRET/);
    const cloud = hostConfig({ ...base, PROVIDER_KEYS_SECRET: "fixed" }, defaults);
    expect(cloud).toMatchObject({ bind: "0.0.0.0", databaseUrl: "postgres://user:secret@db:5432/agents" });
    // The log names the database host, never its credentials.
    expect(describeConfig(cloud)).toContain("db:5432");
    expect(describeConfig(cloud)).not.toContain("secret");
  });

  it("refuses unknown modes, ports and database addresses", () => {
    expect(() => hostConfig({ NODE_HOST_MODE: "prod", API_SERVICE_TOKEN: TOKEN }, defaults)).toThrow(/unbekannt/);
    expect(() => hostConfig({ NODE_HOST_PORT: "99999", API_SERVICE_TOKEN: TOKEN }, defaults)).toThrow(/Port/);
    expect(() => hostConfig({ NODE_HOST_DATABASE_URL: "mysql://x", API_SERVICE_TOKEN: TOKEN }, defaults)).toThrow(/postgres/);
    expect(() => hostConfig({}, defaults)).toThrow(/API_SERVICE_TOKEN/);
    expect(() => hostConfig({ API_SERVICE_TOKEN: TOKEN, NODE_HOST_SWEEP_MS: "500" }, defaults)).toThrow(/SWEEP/);
    expect(hostConfig({ API_SERVICE_TOKEN: TOKEN }, defaults).sweepMs).toBe(30 * 60_000);
  });
});
