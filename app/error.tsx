"use client";

import { useEffect } from "react";

import { Button } from "@ugur/ui";
import { Container } from "@ugur/ui";

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
    <div className="min-h-dvh bg-white text-zinc-900">
      <Container>
        <div className="py-16">
          <h1 className="text-2xl font-semibold">Something went wrong</h1>
          <p className="mt-2 text-sm text-zinc-600">Please try again.</p>
          <div className="mt-6">
            <Button onClick={() => reset()}>Retry</Button>
          </div>
        </div>
      </Container>
    </div>
  );
}
