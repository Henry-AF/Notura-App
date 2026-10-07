"use client";

import { Button } from "@/components/ui/button";

interface AhaCtaProps {
  primaryLabel: string;
  secondaryLabel: string;
  onPrimary: () => void;
  onSecondary: () => void;
}

/** Closing block of the Aha screen: the message, then one primary and one secondary action. */
export function AhaCta({ primaryLabel, secondaryLabel, onPrimary, onSecondary }: AhaCtaProps) {
  return (
    <div className="space-y-4 rounded-2xl bg-primary/10 p-6 text-center">
      <p className="font-display text-xl font-bold text-foreground">
        É isso que o Notura faz com suas reuniões.
      </p>
      <p className="text-[15px] leading-relaxed text-muted-foreground">
        Você conversa.
        <br />
        O Notura organiza.
      </p>
      <Button type="button" onClick={onPrimary} className="h-12 w-full rounded-lg">
        {primaryLabel}
      </Button>
      <Button type="button" variant="ghost" onClick={onSecondary} className="w-full">
        {secondaryLabel}
      </Button>
    </div>
  );
}
