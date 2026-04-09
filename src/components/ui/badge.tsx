import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors",
  {
    variants: {
      variant: {
        default: "border-transparent bg-muted text-muted-foreground",
        recording: "border-transparent bg-primary text-primary-foreground animate-pulse-slow",
        processing: "border-transparent bg-amber-500/15 text-amber-600 dark:text-amber-400",
        completed: "border-transparent bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
        failed: "border-transparent bg-destructive/15 text-destructive",
        "priority-alta": "border-transparent bg-destructive/15 text-destructive",
        "priority-media": "border-transparent bg-amber-500/15 text-amber-600 dark:text-amber-400",
        "priority-baixa": "border-transparent bg-muted text-muted-foreground",
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
