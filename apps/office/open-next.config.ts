import { defineCloudflareConfig } from "@opennextjs/cloudflare";

// No incremental cache: every office page is dynamic and per person.
export default defineCloudflareConfig();
