import { Footer, Header, ScrollProgress } from "@ugur/ui";

export default function WorkLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <ScrollProgress />
      <Header />
      <main>{children}</main>
      <Footer />
    </>
  );
}
