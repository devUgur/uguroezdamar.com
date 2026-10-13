import { ScrollProgress } from "@ugur/ui";
import profile from "@/content/profile";
import { hasAbout } from "@/src/content/profile";
import { SiteHeader, SiteFooter } from "@/src/features/navigation";

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-dvh flex-col bg-background text-foreground transition-colors">
      <ScrollProgress />
      <SiteHeader showAbout={hasAbout(profile)} />
      <main id="main-content" className="flex-1 pt-20">
        {children}
      </main>
      <SiteFooter />
    </div>
  );
}
