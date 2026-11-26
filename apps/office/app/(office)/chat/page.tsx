import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Button } from "@ugur/ui";
import { createThread, listThreads } from "@/src/features/agents";

export const metadata: Metadata = { title: "Chat" };

/** Opens the newest thread; without one, offers to start the first chat. */
export default async function ChatIndexPage() {
  const [latest] = await listThreads();
  if (latest) redirect(`/chat/${latest.id}`);

  return (
    <div className="flex h-full flex-col items-start justify-center gap-4 p-8">
      <h1 className="font-serif text-2xl">Chat mit dem Chef-Agenten</h1>
      <p className="max-w-prose text-sm text-muted-foreground">
        Jeder Chat ist ein eigener Thread mit eigenem Verlauf und eigener Modellwahl. Aktionen mit Außenwirkung wie Commits oder Pull Requests führt der Agent erst nach deiner Freigabe aus.
      </p>
      <form action={createThread}>
        <Button type="submit">Ersten Chat starten</Button>
      </form>
    </div>
  );
}
