"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { toast } from "@ugur/ui";
import { sendMessage, stopThread } from "../../actions";
import type { ModelCatalog, ThreadDetail } from "../../types";
import { ApprovalCard } from "./ApprovalCard";
import { Composer } from "./Composer";
import { MessageList } from "./MessageList";
import { ModelPicker } from "./ModelPicker";
import { ProjectPicker } from "./ProjectPicker";
import { RunActivity } from "./RunActivity";
import { RunFailureNotice } from "./RunFailureNotice";
import { latestRunFailure } from "./runFailure";
import { useLiveRun } from "./useLiveRun";

interface ChatRoomProps {
  detail: ThreadDetail;
  catalog: ModelCatalog;
  liveOrigin: string | null;
  /** Reloads the stored history after a run or a model change: a router refresh on the page, a refetch in a dialog. */
  onRefresh: () => void;
  /** Extra controls in the header, e.g. archiving on the chat page. */
  headerActions?: ReactNode;
}

/** One thread: stored history, the run in progress, open approvals and the composer. */
export function ChatRoom({ detail, catalog, liveOrigin, onRefresh, headerActions }: ChatRoomProps) {
  const { thread, messages, status, approvals, events, projects } = detail;
  const [pending, setPending] = useState<string[]>([]);
  const bottom = useRef<HTMLDivElement>(null);
  const failure = latestRunFailure(events);

  const { run, connected, markRunning, reset, dropApproval } = useLiveRun({
    threadId: thread.id,
    origin: liveOrigin,
    initialRunning: status.running,
    initialApprovals: approvals,
    lastEventId: events.at(-1)?.id ?? 0,
    onSettled: onRefresh,
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
          {liveOrigin ? (connected ? "live" : "verbindet …") : "API nicht konfiguriert"}
        </span>
        {(projects ?? []).length > 1 ? (
          <ProjectPicker threadId={thread.id} value={thread.projectId} projects={projects} disabled={run.running} onChanged={onRefresh} />
        ) : null}
        <ModelPicker
          threadId={thread.id}
          value={thread.model}
          catalog={catalog}
          privateContent={status.private === true || (projects ?? []).find((project) => project.id === thread.projectId)?.visibility === "private"}
          defaultAlias={catalog.agentAliases[thread.agentId] ?? "Standard"}
          onChanged={onRefresh}
        />
        {headerActions}
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto flex max-w-3xl flex-col gap-6 px-6 py-8">
          {messages.length === 0 && !pending.length ? (
            <p className="text-sm text-muted-foreground">
              Schreib dem Agenten einen Auftrag. Er liest das Repository, schlägt Änderungen vor und führt Commits oder Pull Requests erst nach deiner Freigabe aus.
            </p>
          ) : null}
          <MessageList messages={messages} />
          {failure && !run.running && !pending.length ? <RunFailureNotice failure={failure} /> : null}
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
