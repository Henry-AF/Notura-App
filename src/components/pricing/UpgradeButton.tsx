"use client";

import type { CSSProperties } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface UpgradeButtonProps {
  label: string;
  disabled?: boolean;
  loading?: boolean;
  className?: string;
  onClick?: () => void;
  style?: CSSProperties;
}

export function UpgradeButton({
  label,
  disabled = false,
  loading = false,
  className,
  onClick,
  style,
}: UpgradeButtonProps) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      style={style}
      className={cn(
        "inline-flex w-full items-center justify-center gap-2 rounded-full py-2.5 text-sm font-bold transition-all active:scale-[0.97] disabled:cursor-not-allowed",
        className
      )}
    >
      {loading ? <Loader2 className="size-4 animate-spin" /> : null}
      {label}
    </button>
  );
}