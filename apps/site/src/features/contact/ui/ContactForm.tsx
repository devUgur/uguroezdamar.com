"use client";

import { useState } from "react";

import { Button, Card } from "@ugur/ui/client";
import { submitContactRequest } from "../api";

type State = { ok: true } | { ok: false; error: string } | null;

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
      const res = await submitContactRequest(body);
      const data = await res.json();
      if (data.ok) {
        setState({ ok: true });
      } else {
        setState({ ok: false, error: data.error ?? "Failed to save request" });
      }
    } catch {
      setState({ ok: false, error: "Failed to save request" });
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
            className="rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground"
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
            className="rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground"
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
            className="min-h-32 rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground"
            required
          />
        </div>
        <input name="nickname" className="hidden" tabIndex={-1} autoComplete="off" />

        <div className="flex items-center gap-3">
          <Button type="submit" disabled={pending}>
            Send
          </Button>
          {state?.ok ? <p className="text-sm text-zinc-700" role="status">Your request has been saved.</p> : null}
          {state && !state.ok ? (
            <p className="text-sm text-red-600">{state.error}</p>
          ) : null}
        </div>
      </form>
    </Card>
  );
}
