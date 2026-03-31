import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full px-3 py-1 text-xs font-medium transition-colors",
  {
    variants: {
      variant: {
        default: "bg-violet-50 text-violet-700 border border-violet-100",
        recording: "bg-notura-primary text-white animate-pulse-slow",
        processing: "bg-amber-50 text-amber-700",
        completed: "bg-emerald-50 text-emerald-700",
        failed: "bg-red-50 text-red-700",
        "priority-alta": "bg-red-50 text-red-700",
        "priority-media": "bg-amber-50 text-amber-700",
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
