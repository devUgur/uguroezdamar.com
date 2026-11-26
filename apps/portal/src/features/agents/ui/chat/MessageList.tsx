import type { ChatMessage } from "../../types";
import { MessageText } from "./MessageText";

/**
 * The stored conversation. Tool results stay hidden; tool calls appear as a quiet line under the
 * assistant turn that made them, and platform notes about approvals as a centred marker.
 */
export function MessageList({ messages }: { messages: ChatMessage[] }) {
  return (
    <ol className="flex flex-col gap-6" aria-label="Verlauf">
      {messages.map((message, index) => {
        if (message.role === "tool" || message.role === "system") return null;
        const content = message.content?.trim() ?? "";
        if (message.role === "user" && content.startsWith("[System]")) {
          return (
            <li key={index} className="text-center text-xs text-muted-foreground">
              {content.replace(/^\[System\]\s*/, "").replace(/ Ergebnis: .*$/s, "")}
            </li>
          );
        }
        if (message.role === "user") {
          return (
            <li key={index} className="flex justify-end">
              <div className="max-w-[min(42rem,85%)] rounded-lg bg-primary px-4 py-3 text-sm text-primary-foreground">
                <p className="whitespace-pre-wrap break-words">{content}</p>
              </div>
            </li>
          );
        }
        const tools = message.toolCalls?.map((call) => call.name) ?? [];
        return (
          <li key={index} className="flex flex-col gap-2 text-sm">
            {content ? <MessageText text={content} /> : null}
            {tools.length ? (
              <p className="font-mono text-xs text-muted-foreground">
                {tools.map((tool) => `→ ${tool}`).join("  ")}
              </p>
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}
