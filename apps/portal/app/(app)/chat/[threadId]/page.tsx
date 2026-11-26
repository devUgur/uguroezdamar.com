import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ChatRoom, getModelCatalog, getThread, liveOrigin } from "@/src/features/chat";

export const metadata: Metadata = { title: "Chat" };

export default async function ChatThreadPage({ params }: { params: Promise<{ threadId: string }> }) {
  const { threadId } = await params;
  const [detail, catalog] = await Promise.all([getThread(threadId), getModelCatalog()]);
  if (!detail) notFound();
  return <ChatRoom key={threadId} detail={detail} catalog={catalog} liveOrigin={liveOrigin()} />;
}
