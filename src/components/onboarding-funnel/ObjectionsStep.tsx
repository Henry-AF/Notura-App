"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { OBJECTIONS } from "@/lib/onboarding-funnel/content";
import { cn } from "@/lib/utils";

interface ObjectionsStepProps {
  onObjectionViewed: (objectionId: string, index: number) => void;
  onContinue: () => void;
}

/** Short sequence of objections, one at a time, ending on the CTA to the demo. */
export function ObjectionsStep({ onObjectionViewed, onContinue }: ObjectionsStepProps) {
  const [index, setIndex] = useState(0);
  const objection = OBJECTIONS[index];
  const isLast = index === OBJECTIONS.length - 1;

  useEffect(() => {
    onObjectionViewed(objection.id, index);
    // Only a new objection should fire the event, not a new callback identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index]);

  return (
    <section className="space-y-6">
      <ObjectionDots current={index} />
      <div key={objection.id} className="animate-fade-in space-y-4">
        <p className="rounded-xl border border-border bg-card px-4 py-4 text-lg font-semibold italic text-muted-foreground">
          “{objection.quote}”
        </p>
        <h1 className="font-display text-3xl font-bold text-foreground">{objection.answer}</h1>
        <p className="text-[15px] leading-relaxed text-muted-foreground">{objection.detail}</p>
      </div>
      <Button
        type="button"
        onClick={isLast ? onContinue : () => setIndex(index + 1)}
        className="h-12 w-full rounded-lg"
      >
        {isLast ? "Ver uma reunião de exemplo" : "Continuar"}
      </Button>
    </section>
  );
}

function ObjectionDots({ current }: { current: number }) {
  return (
    <div className="flex justify-center gap-2" aria-hidden="true">
      {OBJECTIONS.map((objection, i) => (
        <span
          key={objection.id}
          className={cn(
            "h-2 rounded-full transition-all",
            i === current ? "w-5 bg-primary" : "w-2 bg-primary/30"
          )}
        />
      ))}
    </div>
  );
}
