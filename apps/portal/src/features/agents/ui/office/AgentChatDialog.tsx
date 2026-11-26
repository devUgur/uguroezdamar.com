"use client";

import { useCallback, useEffect, useState } from "react";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle, toast } from "@ugur/ui";
import { loadChat, openAgentChat } from "../../actions";
import type { AgentSummary, ChatView } from "../../types";
import { ChatRoom } from "../chat/ChatRoom";

interface AgentChatDialogProps {
  agent: AgentSummary | null;
  /** Start a new thread instead of continuing the agent's newest one. */
  fresh: boolean;
  /** Scope from the office navigation: null is the company level. */
  projectId: string | null;
  onClose: () => void;
}

/** Chat with one agent without leaving the office; the same chat as on /chat, in a dialog. */
export function AgentChatDialog({ agent, fresh, projectId, onClose }: AgentChatDialogProps) {
  const [view, setView] = useState<ChatView | null>(null);
  const [failed, setFailed] = useState<string | null>(null);

  useEffect(() => {
    setView(null);
    setFailed(null);
    if (!agent) return;
    let cancelled = false;
    openAgentChat(agent.id, fresh, projectId)
      .then((loaded) => !cancelled && setView(loaded))
      .catch((error: unknown) => !cancelled && setFailed(error instanceof Error ? error.message : "Chat konnte nicht geöffnet werden."));
    return () => {
      cancelled = true;
    };
  }, [agent, fresh, projectId]);

  const threadId = view?.detail.thread.id;
  const refresh = useCallback(() => {
    if (!threadId) return;
    loadChat(threadId)
      .then(setView)
      .catch(() => toast.error("Verlauf konnte nicht neu geladen werden."));
  }, [threadId]);

  return (
    <Dialog open={Boolean(agent)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent showCloseButton={false} className="flex h-[min(46rem,calc(100dvh-2rem))] flex-col gap-0 overflow-hidden p-0 sm:max-w-3xl">
        <DialogTitle className="sr-only">Chat mit {agent?.name ?? "Agent"}</DialogTitle>
        <DialogDescription className="sr-only">{agent?.summary}</DialogDescription>
        {view ? (
          <ChatRoom
            detail={view.detail}
            catalog={view.catalog}
            liveOrigin={view.liveOrigin}
            onRefresh={refresh}
            scopeLocked
            headerActions={
              <DialogClose className="rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                Schließen
              </DialogClose>
            }
          />
        ) : (
          <p className="p-8 text-sm text-muted-foreground">{failed ?? "Chat wird geöffnet …"}</p>
        )}
      </DialogContent>
    </Dialog>
  );
}
