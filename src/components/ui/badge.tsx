import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors",
  {
    variants: {
      variant: {
        default: "bg-notura-surface text-notura-ink border border-notura-border",
        recording: "bg-notura-green text-white animate-pulse-slow",
        processing: "bg-amber-100 text-amber-800",
        completed: "bg-notura-green-light text-notura-green",
        failed: "bg-red-100 text-red-700",
        "priority-alta": "bg-red-100 text-red-700",
        "priority-media": "bg-amber-100 text-amber-700",
        "priority-baixa": "bg-gray-100 text-gray-600",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
