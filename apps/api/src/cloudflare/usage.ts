import type { InfraMeasure, InfraUsagePort } from "../platform/ports.ts";

/**
 * Cloudflare's own usage of this account today, from the GraphQL Analytics API (Account Analytics: Read). One query
 * for Workers, Durable Objects, D1 and KV; answers are kept five minutes per isolate, so opening the office often
 * costs at most one query each five minutes.
 */
const QUERY = `query Usage($account: string!, $day: Date!, $from: Time!, $to: Time!) {
  viewer { accounts(filter: { accountTag: $account }) {
    workers: workersInvocationsAdaptive(limit: 1, filter: { datetime_geq: $from, datetime_lt: $to }) { sum { requests } }
    objects: durableObjectsInvocationsAdaptiveGroups(limit: 1, filter: { date: $day }) { sum { requests } }
    d1: d1AnalyticsAdaptiveGroups(limit: 1, filter: { date: $day }) { sum { rowsRead rowsWritten } }
    kv: kvOperationsAdaptiveGroups(limit: 10, filter: { date: $day }) { sum { requests } dimensions { actionType } }
  } }
}`;

interface UsageAnswer {
  data?: { viewer?: { accounts?: {
    workers?: { sum?: { requests?: number } }[];
    objects?: { sum?: { requests?: number } }[];
    d1?: { sum?: { rowsRead?: number; rowsWritten?: number } }[];
    kv?: { sum?: { requests?: number }; dimensions?: { actionType?: string } }[];
  }[] } } | null;
  errors?: { message: string }[] | null;
}

const KEEP_MS = 5 * 60_000;

export function cloudflareUsage(token: string, accountId: string, fetcher: typeof fetch = fetch): InfraUsagePort {
  let kept: { at: number; value: Promise<{ day: string; measures: InfraMeasure[] }> } | undefined;

  async function query(now: Date): Promise<{ day: string; measures: InfraMeasure[] }> {
    const day = now.toISOString().slice(0, 10);
    const response = await fetcher("https://api.cloudflare.com/client/v4/graphql", {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify({ query: QUERY, variables: { account: accountId, day, from: `${day}T00:00:00Z`, to: now.toISOString() } }),
    });
    if (!response.ok) throw new Error(`Cloudflare analytics answered ${response.status}`);
    const answer = (await response.json()) as UsageAnswer;
    if (answer.errors?.length) throw new Error(`Cloudflare analytics: ${answer.errors.map((error) => error.message).join("; ").slice(0, 300)}`);
    const account = answer.data?.viewer?.accounts?.[0];
    const kv = (type: string) => (account?.kv ?? []).filter((group) => group.dimensions?.actionType === type).reduce((sum, group) => sum + (group.sum?.requests ?? 0), 0);
    return {
      day,
      measures: [
        { key: "workers.requests", used: account?.workers?.[0]?.sum?.requests ?? 0 },
        { key: "do.requests", used: account?.objects?.[0]?.sum?.requests ?? 0 },
        { key: "d1.rowsRead", used: account?.d1?.[0]?.sum?.rowsRead ?? 0 },
        { key: "d1.rowsWritten", used: account?.d1?.[0]?.sum?.rowsWritten ?? 0 },
        { key: "kv.reads", used: kv("read") },
        { key: "kv.writes", used: kv("write") + kv("delete") + kv("list") },
      ],
    };
  }

  return {
    today() {
      const now = Date.now();
      if (!kept || now - kept.at > KEEP_MS) {
        const value = query(new Date(now));
        kept = { at: now, value };
        // A failed answer is not kept: the next call asks again.
        value.catch(() => {
          if (kept?.value === value) kept = undefined;
        });
      }
      return kept.value;
    },
  };
}
