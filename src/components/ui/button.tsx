"use client";

import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap font-semibold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/50 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default:
          "rounded-full bg-notura-primary text-white shadow-md hover:bg-notura-primary-dark active:bg-notura-primary-dark hover:-translate-y-0.5 active:translate-y-0",
        secondary:
          "rounded-full border-[1.5px] border-notura-border bg-white text-notura-ink hover:border-violet-300 hover:text-notura-primary active:bg-violet-50",
        ghost:
          "rounded-md text-notura-secondary hover:text-notura-primary hover:bg-violet-50 active:bg-violet-100",
        danger:
          "rounded-full bg-red-600 text-white shadow-sm hover:bg-red-700 active:bg-red-800 hover:-translate-y-0.5 active:translate-y-0",
      },
      size: {
        sm: "h-8 px-4 text-xs",
        md: "h-10 px-5 text-sm",
        lg: "h-12 px-7 text-base",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "md",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
