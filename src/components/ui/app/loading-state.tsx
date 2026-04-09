import * as React from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface LoadingStateProps extends React.HTMLAttributes<HTMLDivElement> {
  label?: string;
}

export function LoadingState({
  label = "Carregando...",
  className,
  ...props
}: LoadingStateProps) {
  return (
    <div
      className={cn(
        "flex min-h-[240px] flex-col items-center justify-center gap-3 rounded-lg border bg-card/60 text-muted-foreground",
        className
      )}
      {...props}
    >
      <Loader2 className="h-6 w-6 animate-spin text-primary" />
      <span className="text-sm font-medium">{label}</span>
    </div>
  );
}
