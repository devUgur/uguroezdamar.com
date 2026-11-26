"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "@ugur/ui";
import { archiveThread, sendMessage, stopThread } from "../actions";
import type { ModelCatalog, ThreadDetail } from "../types";
import { ApprovalCard } from "./ApprovalCard";
import { Composer } from "./Composer";
import { MessageList } from "./MessageList";
import { ModelPicker } from "./ModelPicker";
import { RunActivity } from "./RunActivity";
import { useLiveRun } from "./useLiveRun";

interface ChatRoomProps {
  detail: ThreadDetail;
  catalog: ModelCatalog;
  liveOrigin: string | null;
}

/** One thread: stored history, the run in progress, open approvals and the composer. */
export function ChatRoom({ detail, catalog, liveOrigin }: ChatRoomProps) {
  const { thread, messages, status, approvals, events } = detail;
  const router = useRouter();
  const [, startRefresh] = useTransition();
  const [pending, setPending] = useState<string[]>([]);
  const bottom = useRef<HTMLDivElement>(null);

  const { run, markRunning, reset, dropApproval } = useLiveRun({
    threadId: thread.id,
    origin: liveOrigin,
    initialRunning: status.running,
    initialApprovals: approvals,
    lastEventId: events.at(-1)?.id ?? 0,
    onSettled: () => startRefresh(() => router.refresh()),
  });

  // Fresh server data replaces the live layer: the stored history now holds what streamed in.
  useEffect(() => {
    reset(status.running, approvals);
    setPending([]);
  }, [messages, status.running, approvals, reset]);

  useEffect(() => {
    bottom.current?.scrollIntoView({ block: "end" });
  }, [messages, pending, run.streaming, run.activity.length, run.approvals.length]);

  async function send(text: string): Promise<boolean> {
    setPending((current) => [...current, text]);
    markRunning();
    const result = await sendMessage(thread.id, text);
    if (!result.ok) {
      setPending((current) => current.filter((item) => item !== text));
      toast.error(result.error ?? "Nachricht konnte nicht gesendet werden.");
      return false;
    }
    if (result.message) toast.message(result.message);
    return true;
  }

  async function stop() {
    const result = await stopThread(thread.id);
    if (!result.ok) toast.error(result.error ?? "Stoppen fehlgeschlagen.");
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex flex-wrap items-center gap-3 border-b border-border px-6 py-3">
        <h1 className="min-w-0 flex-1 truncate font-serif text-xl">{thread.title ?? "Neuer Chat"}</h1>
        <span className="text-xs text-muted-foreground" title="Live-Verbindung zur Agenten-API">
          {liveOrigin ? (run.connected ? "live" : "verbindet …") : "API nicht konfiguriert"}
        </span>
        <ModelPicker threadId={thread.id} value={thread.model} catalog={catalog} defaultAlias={catalog.agentAliases[thread.agentId] ?? "Standard"} />
        <form action={archiveThread.bind(null, thread.id)}>
          <button type="submit" className="text-xs text-muted-foreground underline-offset-4 hover:text-destructive hover:underline">
            Archivieren
          </button>
        </form>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto flex max-w-3xl flex-col gap-6 px-6 py-8">
          {messages.length === 0 && !pending.length ? (
            <p className="text-sm text-muted-foreground">
              Schreib dem Chef-Agenten einen Auftrag. Er liest das Repository, schlägt Änderungen vor und führt Commits oder Pull Requests erst nach deiner Freigabe aus.
            </p>
          ) : null}
          <MessageList messages={messages} />
          <RunActivity pending={pending} activity={run.activity} streaming={run.streaming} running={run.running} status={run.status} />
          {run.approvals.map((approval) => (
            <ApprovalCard key={approval.id} approval={approval} onDecided={dropApproval} />
          ))}
          <div ref={bottom} />
        </div>
      </div>

      <Composer running={run.running} onSend={send} onStop={() => void stop()} />
    </div>
  );
}
