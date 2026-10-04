"use client";
import { ErrorState } from "@/components/ui";

export default function GlobalError({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="mx-auto max-w-lg p-8">
      <ErrorState message={error.message || "Unexpected error"} onRetry={reset} />
    </div>
  );
}
