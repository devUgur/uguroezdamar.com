"use client";

import { useActionState } from "react";

import { submitContact } from "@/src/server/contact";
import { Button } from "@ugur/ui";
import { Card } from "@ugur/ui";

type State = { ok: true } | { ok: false; error: string } | null;

export function ContactForm() {
  const [state, action, pending] = useActionState<State, FormData>(
    async (prev, formData) => {
      const res = await submitContact(prev, formData);
      return res.ok ? { ok: true } : { ok: false, error: res.error };
    },
    null,
  );

  return (
    <Card>
      <form action={action} className="grid gap-3">
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
