import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getRunTrace, RunTraceView } from "@/src/features/usage";

export const metadata: Metadata = { title: "Lauf" };

export default async function RunPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { trace, error } = await getRunTrace(id);
  if (error) {
    return (
      <main className="mx-auto w-full max-w-5xl px-5 py-10">
        <p role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm">
          {error}
        </p>
      </main>
    );
  }
  if (!trace) notFound();
  return <RunTraceView trace={trace} />;
}
