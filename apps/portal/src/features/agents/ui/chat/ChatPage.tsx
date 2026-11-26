"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { archiveThread } from "../../actions";
import type { ModelCatalog, ThreadDetail } from "../../types";
import { ChatRoom } from "./ChatRoom";

interface ChatPageProps {
  detail: ThreadDetail;
  catalog: ModelCatalog;
  liveOrigin: string | null;
}

/** The thread on /chat/[threadId]: the stored history reloads through the router. */
export function ChatPage({ detail, catalog, liveOrigin }: ChatPageProps) {
  const router = useRouter();
  const [, startRefresh] = useTransition();
  return (
    <ChatRoom
      detail={detail}
      catalog={catalog}
      liveOrigin={liveOrigin}
      onRefresh={() => startRefresh(() => router.refresh())}
      headerActions={
        <form action={archiveThread.bind(null, detail.thread.id)}>
          <button type="submit" className="text-xs text-muted-foreground underline-offset-4 hover:text-destructive hover:underline">
            Archivieren
          </button>
        </form>
      }
    />
  );
}
