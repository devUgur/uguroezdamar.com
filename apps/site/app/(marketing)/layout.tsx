import { Footer, ScrollProgress } from "@ugur/ui";
import { SiteHeader } from "@/src/features/navigation";

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <ScrollProgress />
      <SiteHeader />
      <main className="pt-20 md:pt-24">{children}</main>
      <Footer />
    </>
  );
}
