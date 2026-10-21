"use client";

import { useState } from "react";
import { Button } from "@ugur/ui";

export function ContactRequestActions({ id, expiresAt }: { id: string; expiresAt: string }) {
  const [deadline, setDeadline] = useState(expiresAt);
  const [removed, setRemoved] = useState(false);
  const [processed, setProcessed] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function update(method: "PATCH" | "DELETE") {
    if (method === "DELETE" && !window.confirm("Permanently delete this contact request?")) return;
    setPending(true);
    setError(null);
    try {
      const response = await fetch(`/api/contact-requests/${id}`, { method });
      const result = (await response.json()) as { ok?: boolean; expiresAt?: string };
      if (!response.ok || !result.ok) throw new Error("Request failed");
      if (method === "DELETE") setRemoved(true);
      else {
        if (result.expiresAt) setDeadline(result.expiresAt);
        setProcessed(true);
      }
    } catch {
      setError("Could not update this request. Please try again.");
    } finally {
      setPending(false);
    }
  }

  if (removed) return <span className="text-xs text-muted-foreground" role="status">Deleted</span>;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs text-muted-foreground">Delete after {new Date(deadline).toLocaleDateString()}</span>
      <Button type="button" variant="secondary" disabled={pending || processed} className="min-h-9 px-2 text-xs" onClick={() => update("PATCH")}>
        {processed ? "Processed" : "Mark processed"}
      </Button>
      <Button type="button" variant="secondary" disabled={pending} className="min-h-9 px-2 text-xs" onClick={() => update("DELETE")}>
        Delete
      </Button>
      {error ? <span className="text-xs text-destructive" role="alert">{error}</span> : null}
    </div>
  );
}
