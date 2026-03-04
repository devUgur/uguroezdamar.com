"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { TimelineItem } from "@/src/features/timeline/types";

type Props = {
  id?: string;
  initial?: TimelineItem;
};

type FormState = {
  type: "work" | "education";
  title: string;
  organization: string;
  location: string;
  startDate: string;
  endDate: string;
  isCurrent: boolean;
  description: string;
  highlights: string;
  status: "draft" | "published";
};

function toDateInput(iso?: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

function buildInitialState(initial?: TimelineItem): FormState {
  const type = (initial?.type ?? "work") as FormState["type"];

  return {
    type,
    title: initial?.title ?? "",
    organization: initial?.organization ?? "",
    location: initial?.location ?? "",
    startDate: toDateInput(initial?.startDate),
    endDate: toDateInput(initial?.endDate),
    isCurrent: initial?.isCurrent ?? false,
    description: initial?.description ?? "",
    highlights: (initial?.highlights ?? []).join("\n"),
    status: initial?.status ?? "draft",
  };
}

export default function AdminTimelineForm({ id, initial }: Props) {
  const router = useRouter();
  const [state, setState] = useState<FormState>(buildInitialState(initial));
  const [busy, setBusy] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isEdit = Boolean(id);

  const canSubmit = useMemo(() => {
    return Boolean(state.title.trim() && state.organization.trim() && state.startDate.trim());
  }, [state.title, state.organization, state.startDate]);

  function setField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setState((prev) => ({ ...prev, [key]: value }));
  }

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setMessage(null);

    if (!canSubmit) {
      setError("Please fill all required fields.");
      return;
    }

    setBusy(true);
    try {
      const payload = {
        type: state.type,
        title: state.title.trim(),
        organization: state.organization.trim(),
        location: state.location.trim() || undefined,
        startDate: new Date(state.startDate).toISOString(),
        endDate: state.endDate.trim() ? new Date(state.endDate).toISOString() : undefined,
        isCurrent: state.isCurrent,
        description: state.description.trim() || undefined,
        highlights: state.highlights
          .split("\n")
          .map((s) => s.trim())
          .filter(Boolean),
        status: state.status,
      };

      const url = isEdit ? `/api/admin/timeline-items/${id}` : "/api/admin/timeline-items";
      const method = isEdit ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok || !data?.ok) {
        throw new Error(data?.error ? JSON.stringify(data.error) : "Failed to save timeline entry");
      }

      setMessage(isEdit ? "Timeline entry updated." : "Timeline entry created.");
      router.refresh();

      if (!isEdit && data?.item?.id) {
        router.push(`/admin/dashboard/timeline/${data.item.id}`);
      }
    } catch (err: unknown) {
      setError((err as Error)?.message ?? "Request failed");
    } finally {
      setBusy(false);
    }
  }

  async function onDelete() {
    if (!id) return;
    if (!window.confirm("Delete this timeline entry?")) return;

    setError(null);
    setMessage(null);
    setDeleting(true);

    try {
      const res = await fetch(`/api/admin/timeline-items/${id}`, { method: "DELETE" });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) {
        throw new Error(data?.error ?? "Failed to delete");
      }
      router.push("/admin/dashboard/timeline");
      router.refresh();
    } catch (err: unknown) {
      setError((err as Error)?.message ?? "Delete failed");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <label className="space-y-2">
          <span className="text-sm font-medium">Type *</span>
          <select
            value={state.type}
            onChange={(e) => setField("type", e.target.value as FormState["type"])}
            className="w-full bg-muted/50 border rounded-lg px-3 py-2 text-sm"
          >
            <option value="work">Work</option>
            <option value="education">Education</option>
          </select>
        </label>

        <label className="space-y-2">
          <span className="text-sm font-medium">Status *</span>
          <select
            value={state.status}
            onChange={(e) => setField("status", e.target.value as FormState["status"])}
            className="w-full bg-muted/50 border rounded-lg px-3 py-2 text-sm"
          >
            <option value="draft">Draft</option>
            <option value="published">Published</option>
          </select>
        </label>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <label className="space-y-2 md:col-span-2">
          <span className="text-sm font-medium">Title *</span>
          <input
            value={state.title}
            onChange={(e) => setField("title", e.target.value)}
            className="w-full bg-muted/50 border rounded-lg px-3 py-2 text-sm"
            placeholder="e.g. Frontend Engineer"
            required
          />
        </label>

        <label className="space-y-2">
          <span className="text-sm font-medium">Organization *</span>
          <input
            value={state.organization}
            onChange={(e) => setField("organization", e.target.value)}
            className="w-full bg-muted/50 border rounded-lg px-3 py-2 text-sm"
            placeholder="e.g. Cherry Communication GmbH"
            required
          />
        </label>

        <label className="space-y-2">
          <span className="text-sm font-medium">Location</span>
          <input
            value={state.location}
            onChange={(e) => setField("location", e.target.value)}
            className="w-full bg-muted/50 border rounded-lg px-3 py-2 text-sm"
            placeholder="Dortmund, DE"
          />
        </label>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <label className="space-y-2">
          <span className="text-sm font-medium">Start Date *</span>
          <input
            type="date"
            value={state.startDate}
            onChange={(e) => setField("startDate", e.target.value)}
            className="w-full bg-muted/50 border rounded-lg px-3 py-2 text-sm"
            required
          />
        </label>

        <label className="space-y-2">
          <span className="text-sm font-medium">End Date</span>
          <input
            type="date"
            value={state.endDate}
            onChange={(e) => setField("endDate", e.target.value)}
            disabled={state.isCurrent}
            className="w-full bg-muted/50 border rounded-lg px-3 py-2 text-sm disabled:opacity-50"
          />
        </label>

        <label className="space-y-2 flex items-end">
          <span className="inline-flex items-center gap-2 text-sm font-medium">
            <input
              type="checkbox"
              checked={state.isCurrent}
              onChange={(e) => setField("isCurrent", e.target.checked)}
              className="rounded"
            />
            Current Position
          </span>
        </label>
      </div>

      <label className="space-y-2 block">
        <span className="text-sm font-medium">Description</span>
        <textarea
          value={state.description}
          onChange={(e) => setField("description", e.target.value)}
          rows={4}
          className="w-full bg-muted/50 border rounded-lg px-3 py-2 text-sm"
          placeholder="Short description shown in public UI"
        />
      </label>

      <label className="space-y-2 block">
        <span className="text-sm font-medium">Highlights (one line each)</span>
        <textarea
          value={state.highlights}
          onChange={(e) => setField("highlights", e.target.value)}
          rows={4}
          className="w-full bg-muted/50 border rounded-lg px-3 py-2 text-sm"
          placeholder={"Built X\nImproved Y\nShipped Z"}
        />
      </label>

      <div className="rounded-lg border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
        Section is now auto-assigned by type: <strong>Work → About</strong>, <strong>Education → Education</strong>.
      </div>

      {(error || message) && (
        <div className={`rounded-lg border px-3 py-2 text-sm ${error ? "border-red-500/30 bg-red-500/10 text-red-600" : "border-green-500/30 bg-green-500/10 text-green-700"}`}>
          {error ?? message}
        </div>
      )}

      <div className="flex items-center justify-between gap-3 pt-2">
        <div>
          {isEdit ? (
            <button
              type="button"
              onClick={onDelete}
              disabled={deleting || busy}
              className="px-4 py-2 rounded-lg border border-red-500/30 text-red-600 hover:bg-red-500/10 text-sm font-medium disabled:opacity-50"
            >
              {deleting ? "Deleting..." : "Delete"}
            </button>
          ) : null}
        </div>

        <button
          type="submit"
          disabled={busy || !canSubmit}
          className="px-4 py-2 bg-foreground text-background rounded-lg text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          {busy ? "Saving..." : isEdit ? "Save Changes" : "Create Entry"}
        </button>
      </div>
    </form>
  );
}
