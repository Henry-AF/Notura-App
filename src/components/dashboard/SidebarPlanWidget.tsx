"use client";

import React from "react";
import { cn } from "@/lib/utils";

export interface SidebarPlanWidgetProps {
  planName: string;
  used: number;
  total: number | null;
  onUpgradeClick?: () => void;
}

function getUsageLabel(used: number, total: number | null) {
  if (typeof total !== "number" || total <= 0) {
    return "Ilimitado";
  }

  return `${used}/${total}`;
}

export function SidebarPlanWidget({
  planName,
  used,
  total,
  onUpgradeClick,
}: SidebarPlanWidgetProps) {
  const hasLimit = typeof total === "number" && total > 0;
  const progress = hasLimit ? Math.min((used / total) * 100, 100) : 100;

  return (
    <section className="rounded-md border border-notura-border/50 bg-transparent p-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-medium text-notura-ink-secondary">
          {planName}
        </p>
        <span className="text-[11px] font-medium text-notura-ink-secondary">
          {getUsageLabel(used, total)}
        </span>
      </div>

      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-notura-border/80">
        <div
          className={cn(
            "h-full rounded-full transition-[width] duration-300",
            hasLimit ? "bg-notura-primary" : "bg-emerald-500"
          )}
          style={{ width: `${progress}%` }}
        />
      </div>

      <p className="mt-2 text-[11px] text-notura-ink-secondary">
        {hasLimit ? `${used} reuniões usadas neste mês.` : "Sem limite mensal."}
      </p>

      {onUpgradeClick && hasLimit && (
        <button
          type="button"
          onClick={onUpgradeClick}
          className="mt-3 text-xs font-semibold text-notura-primary transition-colors hover:text-notura-ink"
        >
          Upgrade para ilimitado
        </button>
      )}
    </section>
  );
}
