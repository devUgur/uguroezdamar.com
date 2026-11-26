"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button, Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@ugur/ui";
import { loadAgentConfig } from "../../actions";
import type { AgentConfig, AgentSummary } from "../../types";
import { ACTIVITY_LABEL, type AgentLiveState } from "./agentState";
import { AgentConfigView } from "./AgentConfigView";

interface AgentConfigSheetProps {
  agent: AgentSummary | null;
  state: AgentLiveState | undefined;
  onClose: () => void;
  onChat: (agent: AgentSummary, fresh: boolean) => void;
}

/** Side sheet for the agent picked in the office: who it is, how it is configured, and the way into a chat. */
export function AgentConfigSheet({ agent, state, onClose, onChat }: AgentConfigSheetProps) {
  const [config, setConfig] = useState<AgentConfig | null>(null);
  const [failed, setFailed] = useState<string | null>(null);

  useEffect(() => {
    setConfig(null);
    setFailed(null);
    if (!agent) return;
    let cancelled = false;
    loadAgentConfig(agent.id)
      .then((loaded) => !cancelled && setConfig(loaded))
      .catch((error: unknown) => !cancelled && setFailed(error instanceof Error ? error.message : "Konfiguration konnte nicht geladen werden."));
    return () => {
      cancelled = true;
    };
  }, [agent]);

  return (
    <Sheet open={Boolean(agent)} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-full gap-0 overflow-hidden sm:max-w-xl">
        {agent ? (
          <>
            <SheetHeader className="gap-1 border-b border-border p-5">
              <SheetTitle className="font-serif text-2xl">{agent.name}</SheetTitle>
              <SheetDescription>{agent.summary}</SheetDescription>
              <p className="text-xs text-muted-foreground">
                Zustand: {ACTIVITY_LABEL[state?.activity ?? "idle"]}
                {agent.lastEventAt ? ` · zuletzt aktiv ${new Date(agent.lastEventAt).toLocaleString("de-DE")}` : ""}
              </p>
              <div className="flex flex-wrap items-center gap-2 pt-2">
                <Button type="button" onClick={() => onChat(agent, false)}>
                  Chatten
                </Button>
                <Button type="button" variant="secondary" onClick={() => onChat(agent, true)}>
                  Neuer Chat
                </Button>
                {agent.lastThreadId ? (
                  <Link href={`/chat/${agent.lastThreadId}`} className="text-sm text-muted-foreground underline-offset-4 hover:underline">
                    Im Chat öffnen
                  </Link>
                ) : null}
              </div>
            </SheetHeader>
            <div className="min-h-0 flex-1 overflow-y-auto px-5 pt-4">
              {config ? <AgentConfigView config={config} /> : <p className="text-sm text-muted-foreground">{failed ?? "Konfiguration wird geladen …"}</p>}
            </div>
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
