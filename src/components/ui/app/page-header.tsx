import * as React from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export interface PageHeaderBreadcrumb {
  label: string;
  href?: string;
}

interface PageHeaderProps
  extends Omit<React.HTMLAttributes<HTMLElement>, "title"> {
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  breadcrumbs?: PageHeaderBreadcrumb[];
  titleClassName?: string;
  descriptionClassName?: string;
}

function PageHeaderBreadcrumbs({
  breadcrumbs,
}: {
  breadcrumbs: PageHeaderBreadcrumb[];
}) {
  return (
    <nav
      aria-label="Breadcrumb"
      className="mb-3 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground"
    >
      {breadcrumbs.map((item, index) => {
        const isLast = index === breadcrumbs.length - 1;

        return (
          <React.Fragment key={`${item.label}-${index}`}>
            {index > 0 ? (
              <ChevronRight className="h-3 w-3 text-muted-foreground/60" />
            ) : null}
            {item.href && !isLast ? (
              <Link
                href={item.href}
                className="transition-colors hover:text-foreground"
              >
                {item.label}
              </Link>
            ) : (
              <span className={isLast ? "text-foreground" : undefined}>
                {item.label}
              </span>
            )}
          </React.Fragment>
        );
      })}
    </nav>
  );
}

export function PageHeader({
  title,
  description,
  actions,
  breadcrumbs,
  className,
  titleClassName,
  descriptionClassName,
  ...props
}: PageHeaderProps) {
  return (
    <header className={className} {...props}>
      {breadcrumbs?.length ? (
        <PageHeaderBreadcrumbs breadcrumbs={breadcrumbs} />
      ) : null}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-1.5">
          <h1
            className={cn(
              "font-display text-3xl font-extrabold text-foreground",
              titleClassName
            )}
          >
            {title}
          </h1>
          {description ? (
            <div
              className={cn(
                "max-w-lg text-sm text-muted-foreground",
                descriptionClassName
              )}
            >
              {description}
            </div>
          ) : null}
        </div>
        {actions ? <div className="shrink-0">{actions}</div> : null}
      </div>
    </header>
  );
}
