import { Header } from "@/shared/ui/Header";
import { Footer } from "@/shared/ui/Footer";
import { ScrollProgress } from "@/shared/ui/ScrollProgress";

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
