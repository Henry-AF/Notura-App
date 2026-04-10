"use client";

import React from "react";
import { AlertCircle } from "lucide-react";
import { SectionCard } from "@/components/ui/app";

export interface AlertPointCardProps {
  alert: string;
}

export function AlertPointCard({ alert }: AlertPointCardProps) {
  return (
    <SectionCard className="rounded-xl">
      <div className="mb-3 flex items-center gap-1.5">
        <AlertCircle className="h-3.5 w-3.5 shrink-0 text-destructive" />
        <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground">
          Ponto de Alerta
        </span>
      </div>
      <p className="font-display text-base font-semibold leading-relaxed text-card-foreground">
        {alert}
      </p>
    </SectionCard>
  );
}
