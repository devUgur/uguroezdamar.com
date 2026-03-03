"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { Profile } from "@/features/profile/types";

type Props = {
  initial?: Profile;
};

type FormState = {
  handle: string;
  headline: string;
  subheadline: string;
  bio: string;
  location: string;
  email: string;
  github: string;
  linkedin: string;
  website: string;
};

function buildInitialState(initial?: Profile): FormState {
  return {
    handle: initial?.handle ?? "main",
    headline: initial?.headline ?? "",
    subheadline: initial?.subheadline ?? "",
    bio: initial?.bio ?? "",
    location: initial?.location ?? "",
    email: initial?.email ?? "",
    github: initial?.links?.github ?? "",
    linkedin: initial?.links?.linkedin ?? "",
    website: initial?.links?.website ?? "",
  };
}

export default function AdminProfileForm({ initial }: Props) {
  const router = useRouter();
  const [state, setState] = useState<FormState>(buildInitialState(initial));
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = useMemo(() => {
    return Boolean(state.handle.trim() && state.headline.trim() && state.bio.trim());
  }, [state.handle, state.headline, state.bio]);

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
        handle: state.handle.trim(),
        headline: state.headline.trim(),
        subheadline: state.subheadline.trim() || undefined,
        bio: state.bio.trim(),
        location: state.location.trim() || undefined,
        email: state.email.trim() || undefined,
        links: {
          github: state.github.trim() || undefined,
          linkedin: state.linkedin.trim() || undefined,
          website: state.website.trim() || undefined,
        },
      };

      const res = await fetch("/api/admin/profile", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) {
        throw new Error(data?.error ? JSON.stringify(data.error) : "Failed to save profile");
      }

      setMessage("Profile saved.");
      router.refresh();
    } catch (err: unknown) {
      setError((err as Error)?.message ?? "Request failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <label className="space-y-2">
          <span className="text-sm font-medium">Handle *</span>
          <input
            value={state.handle}
            onChange={(e) => setField("handle", e.target.value)}
            className="w-full bg-muted/50 border rounded-lg px-3 py-2 text-sm"
            placeholder="main"
            required
          />
        </label>

        <label className="space-y-2">
          <span className="text-sm font-medium">Email</span>
          <input
            type="email"
            value={state.email}
            onChange={(e) => setField("email", e.target.value)}
            className="w-full bg-muted/50 border rounded-lg px-3 py-2 text-sm"
            placeholder="name@example.com"
          />
        </label>
      </div>

      <label className="space-y-2 block">
        <span className="text-sm font-medium">Headline *</span>
        <textarea
          value={state.headline}
          onChange={(e) => setField("headline", e.target.value)}
          rows={4}
          className="w-full bg-muted/50 border rounded-lg px-3 py-2 text-sm"
          placeholder="Main paragraph shown in About section"
          required
        />
      </label>

      <label className="space-y-2 block">
        <span className="text-sm font-medium">Subheadline</span>
        <textarea
          value={state.subheadline}
          onChange={(e) => setField("subheadline", e.target.value)}
          rows={2}
          className="w-full bg-muted/50 border rounded-lg px-3 py-2 text-sm"
          placeholder="Optional text before bio"
        />
      </label>

      <label className="space-y-2 block">
        <span className="text-sm font-medium">Bio *</span>
        <textarea
          value={state.bio}
          onChange={(e) => setField("bio", e.target.value)}
          rows={4}
          className="w-full bg-muted/50 border rounded-lg px-3 py-2 text-sm"
          placeholder="Secondary paragraph shown in About section"
          required
        />
      </label>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <label className="space-y-2">
          <span className="text-sm font-medium">Location</span>
          <input
            value={state.location}
            onChange={(e) => setField("location", e.target.value)}
            className="w-full bg-muted/50 border rounded-lg px-3 py-2 text-sm"
            placeholder="Dortmund, DE"
          />
        </label>

        <label className="space-y-2">
          <span className="text-sm font-medium">Website URL</span>
          <input
            value={state.website}
            onChange={(e) => setField("website", e.target.value)}
            className="w-full bg-muted/50 border rounded-lg px-3 py-2 text-sm"
            placeholder="https://example.com"
          />
        </label>

        <label className="space-y-2">
          <span className="text-sm font-medium">GitHub URL</span>
          <input
            value={state.github}
            onChange={(e) => setField("github", e.target.value)}
            className="w-full bg-muted/50 border rounded-lg px-3 py-2 text-sm"
            placeholder="https://github.com/username"
          />
        </label>

        <label className="space-y-2">
          <span className="text-sm font-medium">LinkedIn URL</span>
          <input
            value={state.linkedin}
            onChange={(e) => setField("linkedin", e.target.value)}
            className="w-full bg-muted/50 border rounded-lg px-3 py-2 text-sm"
            placeholder="https://www.linkedin.com/in/username"
          />
        </label>
      </div>

      {(error || message) && (
        <div className={`rounded-lg border px-3 py-2 text-sm ${error ? "border-red-500/30 bg-red-500/10 text-red-600" : "border-green-500/30 bg-green-500/10 text-green-700"}`}>
          {error ?? message}
        </div>
      )}

      <div className="pt-2 flex justify-end">
        <button
          type="submit"
          disabled={busy || !canSubmit}
          className="px-4 py-2 bg-foreground text-background rounded-lg text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          {busy ? "Saving..." : "Save Profile"}
        </button>
      </div>
    </form>
  );
}
