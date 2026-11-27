import api from "../index.ts";
import { platformFrom, type CloudflareBindings } from "./platform.ts";

/**
 * The Worker entry (wrangler.jsonc "main"). It turns Cloudflare's bindings into the platform ports and hands the
 * request to the core; the Durable Object classes are exported here because wrangler finds them in the entry.
 */
export { AgentRuntime } from "./agent-object.ts";
export { LiveHub } from "./hub-object.ts";
export { KnowledgeIndexer } from "./indexer-object.ts";
export { OfficePresence } from "./presence-object.ts";
export { Workstation } from "./workstation-object.ts";
export { GitGateway, PreviewGateway, RegistryGateway } from "./gateways.ts";

export default {
  fetch(request: Request, bindings: CloudflareBindings): Promise<Response> {
    return api.fetch(request, platformFrom(bindings));
  },
} satisfies ExportedHandler<CloudflareBindings>;
