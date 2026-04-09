import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface SectionCardProps extends React.HTMLAttributes<HTMLDivElement> {
  title?: string;
  description?: string;
  actions?: React.ReactNode;
}

export function SectionCard({
  title,
  description,
  actions,
  className,
  children,
  ...props
}: SectionCardProps) {
  const hasHeader = Boolean(title || description || actions);

  return (
    <Card className={cn("border-border/80 bg-card/95", className)} {...props}>
      {hasHeader && (
        <CardHeader className="space-y-1.5">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1">
              {title ? (
                <CardTitle className="text-base font-semibold text-card-foreground">
                  {title}
                </CardTitle>
              ) : null}
              {description ? (
                <p className="text-sm text-muted-foreground">{description}</p>
              ) : null}
            </div>
            {actions}
          </div>
        </CardHeader>
      )}
      <CardContent className={cn(hasHeader ? "pt-0" : "pt-6")}>{children}</CardContent>
    </Card>
  );
}
