import type { Metadata } from "next";
import { getUsagePage, usageSearch, UsageView, type UsageQuery } from "@/src/features/usage";

export const metadata: Metadata = { title: "Verbrauch" };

type Param = string | string[] | undefined;
const first = (value: Param): string | undefined => (Array.isArray(value) ? value[0] : value);

export default async function UsagePage({ searchParams }: { searchParams: Promise<Record<string, Param>> }) {
  const params = await searchParams;
  const query: UsageQuery = {
    from: first(params.from),
    to: first(params.to),
    project: first(params.project),
    agent: first(params.agent),
    provider: first(params.provider),
    model: first(params.model),
  };
  const page = await getUsagePage(query);
  const search = usageSearch(query);
  return <UsageView page={page} query={query} exportHref={`/api/usage/export${search ? `?${search}` : ""}`} />;
}
