"use client";

import { ErrorState } from "@/components/ui/app";

export default function StartError({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-background px-6">
      <ErrorState
        className="w-full max-w-md"
        title="Não foi possível carregar esta etapa"
        description="Tente novamente em instantes."
        onRetry={reset}
      />
    </main>
  );
}
