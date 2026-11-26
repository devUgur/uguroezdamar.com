import "server-only";

import { redirect } from "next/navigation";
import { agentsApi, agentsApiResponse, isAgentsApiId } from "@/src/adapters/agents-api";
import { getCurrentSession } from "@/src/adapters/auth";
import type { FilterOption, ModelCallRow, RunRow, RunTrace, UsageQuery, UsageSummary } from "./types";

async function actor(): Promise<string> {
  const session = await getCurrentSession();
  if (!session) redirect("/login?next=/usage");
  return session.email;
}

const KEYS: (keyof UsageQuery)[] = ["from", "to", "project", "agent", "provider", "model"];

/** Only known keys with plain values go to the API. */
export function usageSearch(query: UsageQuery): string {
  const params = new URLSearchParams();
  for (const key of KEYS) {
    const value = query[key]?.trim();
    if (value && /^[A-Za-z0-9._:/@-]{1,120}$/.test(value)) params.set(key, value);
  }
  return params.toString();
}

export interface UsagePage {
  summary: UsageSummary | null;
  calls: ModelCallRow[];
  runs: RunRow[];
  projects: FilterOption[];
  agents: FilterOption[];
  error: string | null;
}

export async function getUsagePage(query: UsageQuery): Promise<UsagePage> {
  const who = await actor();
  const search = usageSearch(query);
  try {
    const [summary, calls, runs, projects, agents] = await Promise.all([
      agentsApi<UsageSummary>(`/api/usage/summary?${search}`, who),
      agentsApi<ModelCallRow[]>(`/api/usage/calls?${search}&limit=100`, who),
      agentsApi<RunRow[]>(`/api/usage/runs?${search}&limit=50`, who),
      agentsApi<{ id: string; name: string }[]>("/api/projects", who).catch(() => []),
      agentsApi<{ id: string; name: string }[]>("/api/agents", who).catch(() => []),
    ]);
    return {
      summary,
      calls,
      runs,
      projects: projects.map((project) => ({ id: project.id, label: project.name })),
      agents: agents.map((agent) => ({ id: agent.id, label: agent.name })),
      error: null,
    };
  } catch (error) {
    return { summary: null, calls: [], runs: [], projects: [], agents: [], error: error instanceof Error ? error.message : "Unbekannter Fehler" };
  }
}

export async function getRunTrace(runId: string): Promise<{ trace: RunTrace | null; error: string | null }> {
  const who = await actor();
  if (!isAgentsApiId(runId)) return { trace: null, error: null };
  try {
    return { trace: await agentsApi<RunTrace>(`/api/usage/runs/${runId}`, who), error: null };
  } catch (error) {
    const status = (error as { status?: number }).status;
    return { trace: null, error: status === 404 ? null : error instanceof Error ? error.message : "Unbekannter Fehler" };
  }
}

/** The CSV export of the filtered calls, passed through from the API; null when nobody is signed in. */
export async function exportUsageCsv(query: UsageQuery): Promise<Response | null> {
  const session = await getCurrentSession();
  if (!session) return null;
  const response = await agentsApiResponse(`/api/usage/export.csv?${usageSearch(query)}`, session.email);
  if (!response.ok) return new Response("Export fehlgeschlagen.", { status: 502 });
  return new Response(response.body, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": response.headers.get("content-disposition") ?? 'attachment; filename="verbrauch.csv"',
      "cache-control": "no-store",
    },
  });
}
