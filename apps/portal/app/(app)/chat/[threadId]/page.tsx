import { notFound, redirect } from "next/navigation";
import { isAgentsApiId } from "@/src/adapters/agents-api";
import { officeUrl } from "@/src/adapters/office";

/** Links from the board, the projects and the usage trace keep working: the chat itself is in the office app (ADR 0039). */
export default async function ChatThreadPage({ params }: { params: Promise<{ threadId: string }> }) {
  const { threadId } = await params;
  if (!isAgentsApiId(threadId)) notFound();
  redirect(officeUrl(`/chat/${threadId}`));
}
