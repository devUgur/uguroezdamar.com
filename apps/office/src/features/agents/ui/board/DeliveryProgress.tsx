"use client";

import Link from "next/link";
import { useTransition } from "react";
import { cn } from "@ugur/core";
import { Button, toast } from "@ugur/ui";
import { cancelDelivery, retryDelivery } from "../../actions";
import type { AgentSummary, OfficeDelivery } from "../../types";

interface DeliveryProgressProps {
  delivery: OfficeDelivery;
  agents: AgentSummary[];
  onChanged: () => void;
}

/** The order of the workflow (apps/api/src/workflow/delivery.ts); steps not reached yet are shown greyed. */
const STEPS = [
  { step: "intake", label: "Eingang" },
  { step: "requirements", label: "Anforderungen" },
  { step: "plan", label: "Technischer Plan" },
  { step: "implement", label: "Umsetzung" },
  { step: "qa", label: "QA" },
  { step: "report", label: "Bericht" },
];

const STATUS_TEXT: Record<OfficeDelivery["status"], string> = {
  running: "Das Team arbeitet",
  waiting_owner: "Wartet auf dich",
  awaiting_acceptance: "Bereit zur Abnahme",
  done: "Abgenommen",
  cancelled: "Abgebrochen",
};

const STEP_STATE: Record<string, string> = { running: "arbeitet", waiting_approval: "wartet auf Freigabe", done: "fertig", failed: "fehlgeschlagen", cancelled: "abgebrochen" };

/** A task's way through the team: every step with its role, state and handoff, and what Ugur can do. */
export function DeliveryProgress({ delivery, agents, onChanged }: DeliveryProgressProps) {
  const [pending, startTransition] = useTransition();
  const names = new Map(agents.map((agent) => [agent.id, agent.name]));
  const open = delivery.status === "running" || delivery.status === "waiting_owner" || delivery.status === "awaiting_acceptance";

  function act(work: () => Promise<{ ok: boolean; error?: string }>, success: string) {
    startTransition(async () => {
      const result = await work();
      if (!result.ok) toast.error(result.error ?? "Aktion fehlgeschlagen.");
      else {
        toast.success(success);
        onChanged();
      }
    });
  }

  return (
    <section className="flex flex-col gap-2">
      <h4 className="flex items-baseline justify-between text-xs uppercase tracking-wide text-muted-foreground">
        <span>Team-Ablauf</span>
        <span className={cn(delivery.status === "waiting_owner" && "text-destructive")}>{STATUS_TEXT[delivery.status]}</span>
      </h4>
      {delivery.note ? <p className="rounded-md border border-border p-2 text-xs">{delivery.note}</p> : null}
      <ol className="flex flex-col gap-1.5">
        {STEPS.map((definition) => {
          const runs = delivery.steps.filter((step) => step.step === definition.step);
          const last = runs.at(-1);
          return (
            <li key={definition.step} className={cn("rounded-md border border-border p-2 text-xs", !last && "opacity-50")}>
              <div className="flex items-baseline justify-between gap-2">
                <span className="font-medium">{definition.label}</span>
                <span className="text-muted-foreground">
                  {last ? `${names.get(last.agentId) ?? last.agentId} · ${STEP_STATE[last.status] ?? last.status}${runs.length > 1 ? ` · Runde ${runs.length}` : ""}` : "noch nicht"}
                </span>
              </div>
              {last?.summary ? (
                <details className="mt-1">
                  <summary className="cursor-pointer text-muted-foreground">Übergabe</summary>
                  <p className="mt-1 whitespace-pre-line">{last.summary}</p>
                </details>
              ) : null}
              {last ? (
                <Link href={`/chat/${last.threadId}`} className="mt-1 inline-block text-muted-foreground underline underline-offset-2">
                  Gespräch
                </Link>
              ) : null}
            </li>
          );
        })}
      </ol>
      {open ? (
        <div className="flex flex-wrap gap-2">
          {delivery.status === "waiting_owner" ? (
            <Button disabled={pending} onClick={() => act(() => retryDelivery(delivery.taskId), "Neue Runde gestartet.")}>
              Erneut versuchen
            </Button>
          ) : null}
          <Button variant="secondary" disabled={pending} onClick={() => act(() => cancelDelivery(delivery.taskId), "Ablauf abgebrochen.")}>
            Ablauf abbrechen
          </Button>
        </div>
      ) : null}
    </section>
  );
}
