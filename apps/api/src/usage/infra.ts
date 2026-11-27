import type { Env } from "../env.ts";
import { OWNER_TENANT } from "../tenancy.ts";

/**
 * Infrastructure usage of today against the plan's daily limits (docs/operations/cloudflare-usage.md). The host
 * delivers the numbers through `INFRA_USAGE`; this module only adds labels, limits and the warning threshold.
 * Account-wide, so only the owner sees it.
 */
export const INFRA_LIMITS: Record<string, { label: string; limit: number }> = {
  "do.requests": { label: "Durable-Objects-Requests", limit: 100_000 },
  "workers.requests": { label: "Worker-Requests", limit: 100_000 },
  "d1.rowsRead": { label: "D1 gelesene Zeilen", limit: 5_000_000 },
  "d1.rowsWritten": { label: "D1 geschriebene Zeilen", limit: 100_000 },
  "kv.reads": { label: "KV-Lesungen", limit: 100_000 },
  "kv.writes": { label: "KV-Schreibungen", limit: 1_000 },
};

/** From this share of a limit on, the measure is shown as a warning. */
export const WARN_SHARE = 0.7;

export interface InfraUsageView {
  available: boolean;
  reason?: string;
  day?: string;
  measures: { key: string; label: string; used: number; limit: number; share: number; warn: boolean }[];
}

export async function infraUsage(env: Env, tenantId: string): Promise<InfraUsageView> {
  if (tenantId !== OWNER_TENANT) return { available: false, reason: "Nur für den Owner.", measures: [] };
  if (!env.INFRA_USAGE) return { available: false, reason: "Kein Analytics-Token eingerichtet (CF_ANALYTICS_TOKEN).", measures: [] };
  try {
    const { day, measures } = await env.INFRA_USAGE.today();
    return {
      available: true,
      day,
      measures: measures.flatMap((measure) => {
        const known = INFRA_LIMITS[measure.key];
        if (!known) return [];
        const share = measure.used / known.limit;
        return [{ key: measure.key, label: known.label, used: measure.used, limit: known.limit, share, warn: share >= WARN_SHARE }];
      }),
    };
  } catch (error) {
    console.error("infra usage failed", error);
    return { available: false, reason: "Die Verbrauchsdaten sind gerade nicht abrufbar.", measures: [] };
  }
}
