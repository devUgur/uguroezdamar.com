export const dynamic = "force-dynamic";

import { getCurrentSession } from "@/apps/portal/src/adapters/auth";
import { AppShell, PublicLayout, RedirectIfNotHome } from "@/src/features/shell";

/**
 * Single layout for all (app) routes. Session is known here (server), so we keep
 * PublicLayout (with Footer/Topbar server components) in the server tree.
 * Redirect when not logged in and path !== "/" is done by client RedirectIfNotHome.
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getCurrentSession();

  if (session) {
    return <AppShell>{children}</AppShell>;
  }

  return (
    <>
      <RedirectIfNotHome />
      <PublicLayout>{children}</PublicLayout>
    </>
  );
}
