import { ScrollProgress } from "@ugur/ui";
import { CursorHalo, SiteFooter, SiteHeader } from "@/src/features/navigation";

export default function GermanMarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-background text-foreground transition-colors">
      <ScrollProgress />
      <CursorHalo />
      <SiteHeader />
      <main id="main-content" className="flex-1 pt-20">{children}</main>
      <SiteFooter locale="de" />
    </div>
  );
}
