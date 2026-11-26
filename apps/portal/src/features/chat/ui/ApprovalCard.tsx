"use client";

import { useState, useTransition } from "react";
import { Button, toast } from "@ugur/ui";
import { cn } from "@ugur/core";
import { decideApproval } from "../actions";
import type { Approval } from "../types";

interface ApprovalCardProps {
  approval: Approval;
  /** Called once the decision went through; the card leaves the live view. */
  onDecided: (id: string) => void;
}

/** An action with outside effect that waits for the owner. Security-relevant ones are marked red. */
export function ApprovalCard({ approval, onDecided }: ApprovalCardProps) {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<string | null>(null);
  const security = approval.risk === "security";

  function decide(decision: "approve" | "reject") {
    startTransition(async () => {
      const outcome = await decideApproval(approval.id, decision);
      if (!outcome.ok) {
        toast.error(outcome.error ?? outcome.message ?? "Aktion fehlgeschlagen.");
        setResult(outcome.error ?? "Fehlgeschlagen");
        return;
      }
      setResult(decision === "approve" ? "Freigegeben und ausgeführt." : "Abgelehnt.");
      onDecided(approval.id);
    });
  }

  return (
    <section
      aria-label="Freigabe"
      className={cn("flex flex-col gap-3 rounded-lg border bg-card p-4 text-sm", security ? "border-destructive" : "border-primary/40")}
    >
      <div className="flex flex-col gap-1">
        <p className="font-semibold">Freigabe nötig: {approval.action}</p>
        <p className="break-words text-muted-foreground">{approval.summary ?? approval.action}</p>
      </div>
      {approval.warnings.length ? (
        <ul className="flex flex-col gap-1 text-destructive">
          {approval.warnings.map((warning) => (
            <li key={warning}>{warning}</li>
          ))}
        </ul>
      ) : null}
      {approval.expiresAt ? (
        <p className="text-xs text-muted-foreground">Läuft ab: {new Date(approval.expiresAt * 1000).toLocaleString("de-DE")}</p>
      ) : null}
      {result ? (
        <p className="text-xs text-muted-foreground">{result}</p>
      ) : (
        <div className="flex gap-2">
          <Button type="button" disabled={pending} onClick={() => decide("approve")}>
            Freigeben
          </Button>
          <Button type="button" variant="secondary" disabled={pending} onClick={() => decide("reject")}>
            Ablehnen
          </Button>
        </div>
      )}
    </section>
  );
}
