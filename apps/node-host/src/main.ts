import { resolve } from "node:path";
import { nodePlatform } from "../../api/src/node/platform.ts";
import { startServer } from "./server.ts";

/**
 * The agent API on Node 24, without Cloudflare (ADR 0045, R1). `pnpm dev:office` starts it on :3103 and points
 * portal and office at it. Data lives in `NODE_HOST_DATA` (default apps/node-host/.data), never in Git.
 *
 * Environment: the stage's secrets from `infisical run` (API_SERVICE_TOKEN, model keys); NODE_HOST_PORT,
 * NODE_HOST_BIND (default 127.0.0.1: only this machine), NODE_HOST_DATA.
 */
const port = Number(process.env.NODE_HOST_PORT ?? 3103);
const host = process.env.NODE_HOST_BIND ?? "127.0.0.1";
const dataDir = resolve(process.env.NODE_HOST_DATA ?? resolve(import.meta.dirname, "../.data"));

if (!process.env.API_SERVICE_TOKEN) {
  console.error("[node-host] API_SERVICE_TOKEN fehlt: Portal und Office könnten sich nicht anmelden. Start über `pnpm dev:office`.");
  process.exit(1);
}

const platform = nodePlatform({ dataDir, vars: { ...process.env, API_ENV: process.env.NODE_HOST_ENV ?? "local" } });
const armed = platform.rearm();
const server = startServer(platform, { port, host });
server.on("listening", () => {
  console.log(`[node-host] Agenten-API auf http://${host}:${port}, Daten in ${dataDir}${armed ? `, ${armed} geplante Fortsetzungen übernommen` : ""}.`);
});

function stop(): void {
  server.close();
  platform.close();
  process.exit(0);
}
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
