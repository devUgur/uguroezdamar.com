import Link from "next/link";
import { getAdminOverview } from "@/src/adapters/admin";
import { getCurrentSession } from "@/src/adapters/auth";
import { ContactRequestActions } from "@/src/features/inquiries";
import { Button, Container, Section } from "@ugur/ui";

/**
 * Root "/" – when logged in: Dashboard (sidebar from AppShell).
 * When not logged in: Public landing (no sidebar, from PublicLayout).
 */
export default async function RootPage() {
  const session = await getCurrentSession();

  if (!session) {
    return (
      <Container>
        <Section title="" className="flex flex-col items-center justify-center min-h-[80vh] text-center space-y-8">
          <h1 className="text-4xl md:text-6xl font-bold tracking-tight">
            Welcome to Ugur&apos;s Portal
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl">
            Contact requests and admin accounts for uguroezdamar.com.
          </p>
          <div className="flex gap-4">
            <Button asChild variant="primary">
              <Link href="/login">Login to Portal</Link>
            </Button>
            <Button asChild variant="secondary">
              <Link href="/signup">Sign Up</Link>
            </Button>
          </div>
        </Section>
      </Container>
    );
  }

  const { recentInquiries, inquiriesCount } = await getAdminOverview();

  return (
    <div className="p-8 space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight mb-2">Welcome back, {session.email}</h1>
        <p className="text-muted-foreground">Here is an overview of your portfolio activity.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="p-6 bg-card border rounded-xl shadow-sm space-y-2">
          <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Total Messages</p>
          <p className="text-3xl font-bold">{inquiriesCount}</p>
          <p className="text-xs text-muted-foreground italic">New contact requests from your website.</p>
        </div>
      </div>

      <div className="space-y-4">
        <h2 className="text-xl font-semibold tracking-tight">Recent Messages</h2>
        <div className="overflow-x-auto rounded-xl border bg-card">
          <table className="w-full min-w-[56rem] text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="p-4 text-left font-medium">Name</th>
                <th className="p-4 text-left font-medium">Email</th>
                <th className="p-4 text-left font-medium">Message</th>
                <th className="p-4 text-left font-medium">Date</th>
                <th className="p-4 text-left font-medium">Retention</th>
              </tr>
            </thead>
            <tbody>
              {recentInquiries.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-muted-foreground italic">No messages found.</td>
                </tr>
              ) : (
                recentInquiries.map((inquiry) => (
                  <tr key={inquiry.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                    <td className="p-4 font-medium">{inquiry.name}</td>
                    <td className="p-4 text-muted-foreground">{inquiry.email}</td>
                    <td className="max-w-sm p-4 text-muted-foreground">
                      <details>
                        <summary className="cursor-pointer text-foreground underline decoration-border underline-offset-4">Read request</summary>
                        <p className="mt-3 max-h-48 overflow-auto whitespace-pre-wrap break-words text-sm leading-6">{inquiry.message}</p>
                      </details>
                    </td>
                    <td className="p-4 text-muted-foreground text-xs">{new Date(inquiry.createdAt).toLocaleDateString()}</td>
                    <td className="p-4"><ContactRequestActions id={inquiry.id} expiresAt={inquiry.expiresAt} /></td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
