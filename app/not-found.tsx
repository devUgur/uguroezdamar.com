import Link from "next/link";

import { Button } from "@/shared/ui/Button";
import { Container } from "@/shared/ui/Container";

export default function NotFound() {
  return (
    <Container>
      <div className="py-16">
        <h1 className="text-2xl font-semibold">Page not found</h1>
        <p className="mt-2 text-sm text-zinc-600">
          The page you are looking for does not exist.
        </p>
        <div className="mt-6">
          <Button asChild>
            <Link href="/">Go home</Link>
          </Button>
        </div>
      </div>
    </Container>
  );
}
