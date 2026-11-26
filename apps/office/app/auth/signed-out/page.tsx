import Link from "next/link";

export default function SignedOut() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 p-8 text-center">
      <h1 className="font-serif text-2xl">Abgemeldet</h1>
      <p className="text-sm text-muted-foreground">Die Office-Session ist beendet. Das Portal bleibt angemeldet.</p>
      <Link href="/auth/login" className="text-sm underline underline-offset-4">
        Wieder anmelden
      </Link>
    </main>
  );
}
