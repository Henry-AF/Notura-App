"use client";

import Link from "next/link";
import * as React from "react";
import { PageHeader, type PageHeaderBreadcrumb } from "@/components/ui/app";
import { Card, CardContent } from "@/components/ui/card";
import { LogoFull } from "@/components/logo";

interface AuthShellProps {
  breadcrumbs?: PageHeaderBreadcrumb[];
  title: string;
  description: string;
  sideTitle: string;
  sideDescription: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

export function AuthShell({
  breadcrumbs,
  title,
  description,
  sideTitle,
  sideDescription,
  children,
  footer,
}: AuthShellProps) {
  return (
    <main className="relative min-h-screen bg-background px-4 py-6 md:px-6 md:py-8">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between pb-6">
        <Link href="/" className="inline-flex items-center">
          <LogoFull iconSize={24} />
        </Link>
      </div>

      <div className="mx-auto grid w-full max-w-6xl gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <Card className="hidden overflow-hidden border-primary/20 bg-gradient-to-br from-primary/10 via-card to-background lg:block">
          <CardContent className="flex h-full min-h-[620px] flex-col justify-end px-10 pb-10">
            <div className="max-w-lg space-y-4">
              <span className="inline-flex w-fit items-center rounded-full bg-primary/15 px-3 py-1 text-xs font-bold uppercase tracking-[0.08em] text-primary">
                Notura AI
              </span>
              <h2 className="font-display text-4xl font-extrabold leading-tight text-foreground">
                {sideTitle}
              </h2>
              <p className="text-sm leading-relaxed text-muted-foreground">{sideDescription}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/90 bg-card">
          <CardContent className="space-y-8 p-6 sm:p-10">
            <PageHeader
              breadcrumbs={breadcrumbs}
              title={title}
              description={description}
              titleClassName="text-card-foreground"
              descriptionClassName="max-w-none"
            />
            {children}
            {footer ? <div className="text-sm text-muted-foreground">{footer}</div> : null}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
