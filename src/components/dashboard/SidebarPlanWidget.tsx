"use client";

import React from "react";
import { cn } from "@/lib/utils";

export interface SidebarPlanWidgetProps {
  planName: string;
  used: number;
  total: number | null;
  onUpgradeClick?: () => void;
  variant?: "expanded" | "compact";
}

function getUsageLabel(used: number, total: number | null) {
  if (typeof total !== "number" || total <= 0) {
    return `${used}/Personalizado`;
  }

  return `${used}/${total}`;
}

function getUsageProgress(used: number, total: number | null) {
  if (typeof total !== "number" || total <= 0) {
    return 100;
  }

  return Math.min(Math.round((used / total) * 100), 100);
}

function getCompactPlanLabel(planName: string) {
  return planName.replace(/^Plano\s+/i, "");
}

function CompactPlanGauge({
  planName,
  progress,
}: {
  planName: string;
  progress: number;
}) {
  const planLabel = getCompactPlanLabel(planName);
  const arcLength = 70;
  const progressLength = (progress / 100) * arcLength;

  return (
    <section
      aria-label={`Quota do plano ${planName}: ${progress}% usado`}
      className="flex w-12 flex-col items-center"
    >
      <div className="relative h-11 w-12">
        <svg
          aria-hidden="true"
          viewBox="0 0 64 56"
          className="h-11 w-12 overflow-visible"
        >
          <circle
            cx="32"
            cy="32"
            r="23"
            fill="none"
            pathLength={100}
            stroke="currentColor"
            strokeDasharray={`${arcLength} 100`}
            strokeLinecap="round"
            strokeWidth="7"
            transform="rotate(144 32 32)"
            className="text-notura-border/80"
          />
          <circle
            cx="32"
            cy="32"
            r="23"
            fill="none"
            pathLength={100}
            stroke="currentColor"
            strokeDasharray={`${progressLength} 100`}
            strokeLinecap="round"
            strokeWidth="7"
            transform="rotate(144 32 32)"
            className="text-notura-primary drop-shadow-[0_0_8px_rgba(104,81,255,0.35)]"
          />
        </svg>
        <span className="absolute left-1/2 top-[54%] -translate-x-1/2 -translate-y-1/2 text-[10px] font-bold leading-none text-notura-ink">
          {progress}%
        </span>
      </div>
      <span className="mt-0.5 max-w-12 truncate text-center text-[9px] font-medium leading-none text-notura-ink-secondary">
        {planLabel}
      </span>
    </section>
  );
}

export function SidebarPlanWidget({
  planName,
  used,
  total,
  onUpgradeClick,
  variant = "expanded",
}: SidebarPlanWidgetProps) {
  const hasLimit = typeof total === "number" && total > 0;
  const progress = getUsageProgress(used, total);

  if (variant === "compact") {
    return <CompactPlanGauge planName={planName} progress={progress} />;
  }

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
        {hasLimit ? `${used} reuniões usadas neste mês.` : "Limite personalizado."}
      </p>

      {onUpgradeClick && hasLimit && (
        <button
          type="button"
          onClick={onUpgradeClick}
          className="mt-3 text-xs font-semibold text-notura-primary transition-colors hover:text-notura-ink"
        >
          Ver planos
        </button>
      )}
    </section>
  );
}
