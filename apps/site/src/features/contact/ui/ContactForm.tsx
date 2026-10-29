"use client";

import { useRef, useState } from "react";
import Link from "next/link";

import { submitContactRequest } from "../api";
import { copy, type Locale } from "@/src/features/navigation/copy";

type State = { ok: true } | { ok: false; error: string } | null;

export function ContactForm({ locale = "en" }: { locale?: Locale }) {
  const text = copy[locale];
  const [privacyBefore, privacyAfter = ""] = text.contactPrivacyNote.split(text.contactPrivacyLink);
  const [state, setState] = useState<State>(null);
  const [pending, setPending] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

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
        formRef.current?.reset();
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
        ref={formRef}
        method="POST"
        action="/api/contact"
        className="grid gap-7"
        onSubmit={(e) => {
          e.preventDefault();
          handleSubmit(new FormData(e.currentTarget));
        }}
      >
        <div className="grid gap-2">
          <label className="font-mono text-xs uppercase tracking-wider text-muted-foreground" htmlFor="contact-name">
            {text.name}
          </label>
          <input
            id="contact-name"
            name="name"
            autoComplete="name"
            maxLength={120}
            aria-describedby="contact-name-hint"
            className="min-h-12 rounded-none border border-input bg-background px-4 py-3 text-base text-foreground outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            required
          />
          <p id="contact-name-hint" className="text-xs leading-5 text-muted-foreground">{text.contactNameHint}</p>
        </div>
        <div className="grid gap-2">
          <label className="font-mono text-xs uppercase tracking-wider text-muted-foreground" htmlFor="contact-email">
            {text.email}
          </label>
          <input
            id="contact-email"
            name="email"
            type="email"
            autoComplete="email"
            maxLength={320}
            aria-describedby="contact-email-hint"
            className="min-h-12 rounded-none border border-input bg-background px-4 py-3 text-base text-foreground outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            required
          />
          <p id="contact-email-hint" className="text-xs leading-5 text-muted-foreground">{text.contactEmailHint}</p>
        </div>
        <div className="grid gap-2">
          <label className="font-mono text-xs uppercase tracking-wider text-muted-foreground" htmlFor="contact-message">
            {text.message}
          </label>
          <textarea
            id="contact-message"
            name="message"
            maxLength={5000}
            aria-describedby="contact-message-hint"
            className="min-h-36 resize-y rounded-none border border-input bg-background px-4 py-3 text-base leading-7 text-foreground outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            required
          />
          <p id="contact-message-hint" className="text-xs leading-5 text-muted-foreground">{text.contactMessageHint}</p>
        </div>
        <input name="nickname" className="hidden" tabIndex={-1} autoComplete="off" />

        <p className="max-w-2xl border-l border-border pl-4 text-sm leading-6 text-muted-foreground">
          {privacyBefore}
          <Link href={locale === "de" ? "/de/privacy" : "/privacy"} className="text-foreground underline decoration-border underline-offset-4 hover:decoration-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
            {text.contactPrivacyLink}
          </Link>
          {privacyAfter}
        </p>

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
