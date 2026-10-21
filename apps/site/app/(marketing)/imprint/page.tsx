import { PageIntro } from "@/src/components/public/PageIntro";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Imprint" };

export default function ImprintPage() {
  return (
    <article className="site-container py-16 md:py-24">
      <PageIntro section="Legal" title="Imprint" description="Legal disclosure." />
      <div className="mt-12 max-w-3xl border-t border-border pt-6 text-sm leading-7 text-muted-foreground">
        <p>Replace with imprint details.</p>
      </div>
    </article>
  );
}
