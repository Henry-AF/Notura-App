"use client";

import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BRAND_PROMISE, type ResolvedPromise } from "@/lib/onboarding-funnel/content";

interface PromiseStepProps {
  promise: ResolvedPromise;
  onContinue: () => void;
}

/** Personalized promise (problem + profile + goals) followed by the brand line. */
export function PromiseStep({ promise, onContinue }: PromiseStepProps) {
  return (
    <section className="space-y-6">
      <div className="space-y-3">
        <h1 className="font-display text-2xl font-bold leading-tight text-foreground sm:text-3xl">
          {promise.title}
        </h1>
        <p className="text-[15px] leading-relaxed text-muted-foreground">{promise.description}</p>
        {promise.profileLine ? (
          <p className="text-[15px] leading-relaxed text-muted-foreground">{promise.profileLine}</p>
        ) : null}
      </div>

      {promise.goals.length > 0 ? <GoalSummary goals={promise.goals} /> : null}

      <p className="rounded-xl bg-primary/10 px-4 py-4 text-center font-display text-lg font-bold text-primary">
        Você participa da reunião. O Notura cuida do resto.
      </p>
      <p className="text-center text-xs text-muted-foreground">{BRAND_PROMISE}</p>

      <Button type="button" onClick={onContinue} className="h-12 w-full rounded-lg">
        Quero ver na prática
      </Button>
    </section>
  );
}

function GoalSummary({ goals }: { goals: string[] }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="mb-3 text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
        O que você pediu
      </p>
      <ul className="space-y-2">
        {goals.map((goal) => (
          <li key={goal} className="flex items-start gap-2 text-sm text-foreground">
            <Check className="mt-0.5 size-4 shrink-0 text-primary" />
            {goal}
          </li>
        ))}
      </ul>
    </div>
  );
}
