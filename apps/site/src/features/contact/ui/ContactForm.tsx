"use client";

import { useState } from "react";

import { Button } from "@ugur/ui";
import { Card } from "@ugur/ui";

type State = { ok: true } | { ok: false; error: string } | null;

function getContactApiUrl(): string {
  if (typeof window !== "undefined") {
    return process.env.NEXT_PUBLIC_CONTACT_API_URL ?? `${window.location.origin}/api/contact`;
  }
  return process.env.NEXT_PUBLIC_CONTACT_API_URL ?? "/api/contact";
}

export function ContactForm() {
  const [state, setState] = useState<State>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(formData: FormData) {
    setPending(true);
    setState(null);
    try {
      const body = {
        name: String(formData.get("name") ?? ""),
        email: String(formData.get("email") ?? ""),
        message: String(formData.get("message") ?? ""),
        nickname: String(formData.get("nickname") ?? ""),
      };
      const res = await fetch(getContactApiUrl(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.ok) {
        setState({ ok: true });
      } else {
        setState({ ok: false, error: data.error ?? "Failed to send" });
      }
    } catch {
      setState({ ok: false, error: "Failed to send" });
    } finally {
      setPending(false);
    }
  }

  return (
    <Card>
      <form
        className="grid gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          handleSubmit(new FormData(e.currentTarget));
        }}
      >
        <div className="grid gap-1">
          <label className="text-sm font-medium" htmlFor="name">
            Name
          </label>
          <input
            id="name"
            name="name"
            className="rounded-md border border-zinc-200 px-3 py-2 text-sm"
            required
          />
        </div>
        <div className="grid gap-1">
          <label className="text-sm font-medium" htmlFor="email">
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            className="rounded-md border border-zinc-200 px-3 py-2 text-sm"
            required
          />
        </div>
        <div className="grid gap-1">
          <label className="text-sm font-medium" htmlFor="message">
            Message
          </label>
          <textarea
            id="message"
            name="message"
            className="min-h-32 rounded-md border border-zinc-200 px-3 py-2 text-sm"
            required
          />
        </div>
        <input name="nickname" className="hidden" tabIndex={-1} autoComplete="off" />

        <div className="flex items-center gap-3">
          <Button type="submit" disabled={pending}>
            Send
          </Button>
          {state?.ok ? <p className="text-sm text-zinc-700">Sent.</p> : null}
          {state && !state.ok ? (
            <p className="text-sm text-red-600">{state.error}</p>
          ) : null}
        </div>
      </form>
    </Card>
  );
}
