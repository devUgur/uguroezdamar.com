import { Footer, Header, ScrollProgress } from "@ugur/ui";

export const dynamic = "force-dynamic";

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <ScrollProgress />
      <Header />
      <main>{children}</main>
      <Footer />
    </>
  );
}
