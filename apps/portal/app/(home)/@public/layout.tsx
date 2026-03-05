import { Topbar, Footer } from "@ugur/ui";

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col min-h-screen">
      <Topbar />
      <main className="flex-1">
        {children}
      </main>
      <Footer />
    </div>
  );
}
