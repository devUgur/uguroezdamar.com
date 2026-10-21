import Link from "next/link";
import { Button, Container } from "@ugur/ui";
export default function GermanNotFound() { return <Container><div className="py-16"><h1 className="text-2xl font-semibold">Seite nicht gefunden</h1><p className="mt-2 text-sm text-muted-foreground">Die aufgerufene Seite existiert nicht.</p><div className="mt-6"><Button asChild><Link href="/de">Zur Startseite</Link></Button></div></div></Container>; }
