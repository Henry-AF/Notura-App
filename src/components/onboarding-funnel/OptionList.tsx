"use client";

import { Check } from "lucide-react";
import type { Option } from "@/lib/onboarding-funnel/types";
import { cn } from "@/lib/utils";

interface OptionListProps<T extends string> {
  options: Option<T>[];
  selected: T[];
  multiple?: boolean;
  columns?: 1 | 2;
  onSelect: (id: T) => void;
}

/** Selectable answers. Single mode behaves as a radio group, multiple as checkboxes. */
export function OptionList<T extends string>({
  options,
  selected,
  multiple = false,
  columns = 1,
  onSelect,
}: OptionListProps<T>) {
  return (
    <div
      role={multiple ? "group" : "radiogroup"}
      className={cn("grid gap-3", columns === 2 && "sm:grid-cols-2")}
    >
      {options.map((option) => (
        <OptionButton
          key={option.id}
          label={option.label}
          checked={selected.includes(option.id)}
          multiple={multiple}
          onClick={() => onSelect(option.id)}
        />
      ))}
    </div>
  );
}

interface OptionButtonProps {
  label: string;
  checked: boolean;
  multiple: boolean;
  onClick: () => void;
}

function OptionButton({ label, checked, multiple, onClick }: OptionButtonProps) {
  return (
    <button
      type="button"
      role={multiple ? "checkbox" : "radio"}
      aria-checked={checked}
      onClick={onClick}
      className={cn(
        "flex min-h-[56px] items-center justify-between gap-3 rounded-xl border bg-card px-4 py-3.5 text-left text-[15px] font-medium text-foreground transition-colors hover:border-primary/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
        checked ? "border-primary bg-primary/10" : "border-border"
      )}
    >
      <span>{label}</span>
      <span
        className={cn(
          "flex size-5 shrink-0 items-center justify-center border",
          multiple ? "rounded-md" : "rounded-full",
          checked ? "border-primary bg-primary text-primary-foreground" : "border-border"
        )}
      >
        {checked ? <Check className="size-3.5" /> : null}
      </span>
    </button>
  );
}
