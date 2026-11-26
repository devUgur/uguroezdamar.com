import { redirect } from "next/navigation";

/** The office moved into its own fullscreen app; old links (board, organization) keep working. */
export default async function AgentsPage({ searchParams }: { searchParams: Promise<{ agent?: string | string[] }> }) {
  const { agent } = await searchParams;
  redirect(typeof agent === "string" ? `/office?agent=${encodeURIComponent(agent)}` : "/office");
}
