"use client";

import { useEffect } from "react";

import { Button, Container } from "@ugur/ui/client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="min-h-dvh bg-background text-foreground">
      <Container>
        <div className="py-16">
          <h1 className="text-2xl font-semibold">Something went wrong</h1>
          <p className="mt-2 text-sm text-muted-foreground">Please try again.</p>
          <div className="mt-6">
            <Button onClick={() => reset()}>Retry</Button>
          </div>
        </div>
      </Container>
    </div>
  );
}
