export const dynamic = "force-dynamic";

import { getCurrentSession } from "@/apps/portal/src/adapters/auth";
import { AppShell } from "@/src/features/admin/ui/AppShell";
import { PublicLayout } from "@/src/features/admin/ui/PublicLayout";
import { RedirectIfNotHome } from "@/src/features/admin/ui/RedirectIfNotHome";

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
