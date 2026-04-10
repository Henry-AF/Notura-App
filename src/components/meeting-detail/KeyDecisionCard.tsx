"use client";

import React from "react";
import { Star } from "lucide-react";
import { SectionCard } from "@/components/ui/app";

export interface KeyDecisionCardProps {
  decision: string;
}

export function KeyDecisionCard({ decision }: KeyDecisionCardProps) {
  return (
    <SectionCard className="rounded-xl">
      <div className="mb-3 flex items-center gap-1.5">
        <Star className="h-3.5 w-3.5 shrink-0 text-amber-500" />
        <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground">
          Decisão Chave
        </span>
      </div>
      <p className="font-display text-base font-semibold leading-relaxed text-card-foreground">
        {decision}
      </p>
    </SectionCard>
  );
}
