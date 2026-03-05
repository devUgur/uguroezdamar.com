import { getCurrentSession } from "@/apps/portal/src/adapters/auth";

export default async function HomeLayout({
  public: publicSlot,
  authed: authedSlot,
}: {
  public: React.ReactNode;
  authed: React.ReactNode;
}) {
  const session = await getCurrentSession();

  if (session) {
    return <>{authedSlot}</>;
  }

  return <>{publicSlot}</>;
}
