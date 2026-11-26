import { redirect } from "next/navigation";
import { officeUrl } from "@/src/adapters/office";

/** The agents' office moved into its own app (ADR 0039); old links (board, organization) keep working. */
export default async function AgentsPage({ searchParams }: { searchParams: Promise<{ agent?: string | string[] }> }) {
  const { agent } = await searchParams;
  redirect(officeUrl(typeof agent === "string" ? `/?agent=${encodeURIComponent(agent)}` : "/"));
}
