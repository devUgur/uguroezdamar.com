import { ScrollProgress } from "@ugur/ui";
import { SiteHeader, SiteFooter } from "@/src/features/navigation";

export const dynamic = "force-dynamic";

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-dvh flex-col bg-background text-foreground transition-colors">
      <ScrollProgress />
      <SiteHeader />
      <main id="main-content" className="flex-1 pt-20">
        {children}
      </main>
      <SiteFooter />
    </div>
  );
}
