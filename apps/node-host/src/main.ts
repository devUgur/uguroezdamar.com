import { resolve } from "node:path";
import { nodePlatform } from "../../api/src/node/platform.ts";
import { ConfigError, describe, hostConfig, type HostConfig } from "./mode.ts";
import { postgresJsSql } from "./postgres-js.ts";
import { startServer } from "./server.ts";

/**
 * The agent API on Node 24, without Cloudflare (ADR 0045). `pnpm dev:office` starts it on :3103 and points portal
 * and office at it; deployments/docker runs it as a container. The configuration is checked once in `mode.ts`.
 */
let config: HostConfig;
try {
  config = hostConfig(process.env, { dataDir: resolve(import.meta.dirname, "../.data") });
} catch (error) {
  if (!(error instanceof ConfigError)) throw error;
  console.error(`[node-host] ${error.message}`);
  process.exit(1);
}

const sql = config.databaseUrl ? await postgresJsSql(config.databaseUrl) : undefined;
const platform = nodePlatform({ dataDir: resolve(config.dataDir), sql, vars: { ...process.env, API_ENV: config.apiEnv } });
const armed = platform.rearm();
const server = startServer(platform, { port: config.port, host: config.bind });
server.on("listening", () => {
  console.log(`[node-host] Agenten-API auf http://${config.bind}:${config.port}. ${describe(config)}${armed ? `; ${armed} Wecker übernommen` : ""}.`);
});

function stop(): void {
  server.close();
  platform.close();
  process.exit(0);
}
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
