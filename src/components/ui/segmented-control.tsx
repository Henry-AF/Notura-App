"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export interface SegmentedControlOption<T extends string = string> {
  value: T;
  label: React.ReactNode;
  icon?: React.ReactNode;
}

interface SegmentedControlProps<T extends string = string> {
  options: SegmentedControlOption<T>[];
  value: T;
  onChange: (value: T) => void;
  activeClassName?: string;
  className?: string;
}

export function SegmentedControl<T extends string = string>({
  options,
  value,
  onChange,
  activeClassName,
  className,
}: SegmentedControlProps<T>) {
  return (
    <div
      role="radiogroup"
      className={cn(
        "grid grid-cols-3 items-stretch gap-1 rounded-lg border border-border/60 bg-muted/50 p-1 sm:flex",
        className
      )}
    >
      {options.map((option) => {
        const isActive = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={isActive}
            onClick={() => onChange(option.value)}
            className={cn(
              "inline-flex min-w-0 flex-col items-center justify-center gap-1 rounded-md px-2 py-2 text-[11px] font-medium transition-all duration-200 sm:flex-1 sm:flex-row sm:gap-2 sm:px-3 sm:text-sm",
              isActive
                ? cn("shadow-sm", activeClassName ?? "bg-background text-foreground")
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <span className="shrink-0">{option.icon}</span>
            <span className="truncate">{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}
