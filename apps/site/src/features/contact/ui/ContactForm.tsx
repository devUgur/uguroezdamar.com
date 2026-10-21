"use client";

import { useState } from "react";

import { submitContactRequest } from "../api";
import { copy, type Locale } from "@/src/features/navigation/copy";

type State = { ok: true } | { ok: false; error: string } | null;

export function ContactForm({ locale = "en" }: { locale?: Locale }) {
  const text = copy[locale];
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
        setState({ ok: false, error: data.error ?? text.sendError });
      }
    } catch {
      setState({ ok: false, error: text.sendError });
    } finally {
      setPending(false);
    }
  }

  return (
    <form
        className="grid gap-7"
        onSubmit={(e) => {
          e.preventDefault();
          handleSubmit(new FormData(e.currentTarget));
        }}
      >
        <div className="grid gap-2">
          <label className="font-mono text-xs uppercase tracking-wider text-muted-foreground" htmlFor="name">
            {text.name}
          </label>
          <input
            id="name"
            name="name"
            className="min-h-12 rounded-none border-x-0 border-t-0 border-b border-input bg-transparent px-0 py-3 text-base text-foreground outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            required
          />
        </div>
        <div className="grid gap-2">
          <label className="font-mono text-xs uppercase tracking-wider text-muted-foreground" htmlFor="email">
            {text.email}
          </label>
          <input
            id="email"
            name="email"
            type="email"
            className="min-h-12 rounded-none border-x-0 border-t-0 border-b border-input bg-transparent px-0 py-3 text-base text-foreground outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            required
          />
        </div>
        <div className="grid gap-2">
          <label className="font-mono text-xs uppercase tracking-wider text-muted-foreground" htmlFor="message">
            {text.message}
          </label>
          <textarea
            id="message"
            name="message"
            className="min-h-36 resize-y rounded-none border-x-0 border-t-0 border-b border-input bg-transparent px-0 py-3 text-base leading-7 text-foreground outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            required
          />
        </div>
        <input name="nickname" className="hidden" tabIndex={-1} autoComplete="off" />

        <div className="flex flex-wrap items-center gap-4">
          <button type="submit" disabled={pending} className="inline-flex min-h-11 items-center justify-center border border-foreground px-5 font-mono text-xs uppercase tracking-widest text-foreground transition-colors hover:bg-foreground hover:text-background focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-60">
            {pending ? text.sending : text.sendMessage}
          </button>
          {state?.ok ? <p className="text-sm text-muted-foreground" role="status">{text.sent}</p> : null}
          {state && !state.ok ? (
            <p className="text-sm text-destructive" role="alert">{state.error}</p>
          ) : null}
        </div>
    </form>
  );
}
