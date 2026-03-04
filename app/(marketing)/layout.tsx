import { Header } from "@ugur/ui";
import { Footer } from "@ugur/ui";
import { ScrollProgress } from "@ugur/ui";

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
