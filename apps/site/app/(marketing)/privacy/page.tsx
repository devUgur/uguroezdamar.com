import { PageIntro } from "@/src/components/public/PageIntro";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Privacy" };

export default function PrivacyPage() {
  return (
    <article className="site-container py-16 md:py-24">
      <PageIntro section="Legal" title="Privacy" description="Privacy policy." />
      <div className="mt-12 max-w-3xl border-t border-border pt-6 text-sm leading-7 text-muted-foreground">
        <p>Replace with your privacy policy text.</p>
      </div>
    </article>
  );
}
