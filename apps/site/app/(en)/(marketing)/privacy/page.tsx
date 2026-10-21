import { PageIntro } from "@/src/components/public/PageIntro";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Privacy", alternates: { canonical: "/privacy", languages: { en: "/privacy", de: "/de/privacy" } } };

export default function PrivacyPage() {
  return (
    <article className="site-container py-16 md:py-24">
      <PageIntro section="Legal" title="Privacy" description="Privacy information." />
      <div className="mt-12 max-w-3xl border-t border-border pt-6 text-sm leading-7 text-muted-foreground">
        <p>The complete privacy notice still needs to be provided and reviewed before this page can serve as a legally complete disclosure.</p>
      </div>
    </article>
  );
}
