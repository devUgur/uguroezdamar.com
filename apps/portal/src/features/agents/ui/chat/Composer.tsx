"use client";

import { useState } from "react";
import { Button } from "@ugur/ui";

interface ComposerProps {
  running: boolean;
  onSend: (text: string) => Promise<boolean>;
  onStop: () => void;
}

/** Enter sends, Shift+Enter breaks the line. While a run is going, a message joins it at the next step. */
export function Composer({ running, onSend, onStop }: ComposerProps) {
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);

  async function submit() {
    const value = text.trim();
    if (!value || sending) return;
    setSending(true);
    setText("");
    const ok = await onSend(value);
    if (!ok) setText(value);
    setSending(false);
  }

  return (
    <form
      className="flex items-end gap-2 border-t border-border bg-background p-4"
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
    >
      <label htmlFor="chat-input" className="sr-only">
        Nachricht an den Agenten
      </label>
      <textarea
        id="chat-input"
        value={text}
        rows={2}
        onChange={(event) => setText(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
            event.preventDefault();
            void submit();
          }
        }}
        placeholder={running ? "Hinweis für den laufenden Auftrag …" : "Auftrag an den Chef-Agenten …"}
        className="min-h-11 flex-1 resize-none rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      />
      {running ? (
        <Button type="button" variant="secondary" onClick={onStop}>
          Stopp
        </Button>
      ) : null}
      <Button type="submit" disabled={sending || !text.trim()}>
        Senden
      </Button>
    </form>
  );
}
