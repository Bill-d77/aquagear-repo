import { defineCloudflareConfig } from "@opennextjs/cloudflare";

// ponytail: no incremental cache — every page is force-dynamic. Add an R2 cache if ISR ever lands.
export default defineCloudflareConfig();
