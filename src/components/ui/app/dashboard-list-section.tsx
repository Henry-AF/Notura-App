import * as React from "react";
import { SectionCard } from "./section-card";
import { cn } from "@/lib/utils";

export interface DashboardListSectionProps {
  title?: string;
  description?: string;
  context?: React.ReactNode;
  actions?: React.ReactNode;
  header?: React.ReactNode;
  emptyState?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  contentClassName?: string;
}

export function DashboardListSection({
  title,
  description,
  context,
  actions,
  header,
  emptyState,
  children,
  className,
  contentClassName,
}: DashboardListSectionProps) {
  return (
    <SectionCard
      title={title}
      description={description}
      className={cn("min-w-0 max-w-full overflow-hidden", className)}
      contentClassName={contentClassName}
    >
      {context || actions ? (
        <div className="mb-3 flex min-w-0 flex-col gap-3 sm:mb-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 flex-1">{context}</div>
          {actions ? (
            <div className="w-full min-w-0 sm:w-auto sm:shrink-0">
              {actions}
            </div>
          ) : null}
        </div>
      ) : null}

      {header ? (
        <div className={cn("hidden border-b px-3 pb-3 sm:block")}>
          {header}
        </div>
      ) : null}

      {emptyState ? emptyState : children}
    </SectionCard>
  );
}
