"use client";

import Link from "next/link";
import * as React from "react";
import { ChevronLeft } from "lucide-react";
import { PageHeader, type PageHeaderBreadcrumb } from "@/components/ui/app";
import { Card, CardContent } from "@/components/ui/card";
import { LogoFull } from "@/components/logo";
import { BannerCarousel } from "@/components/dashboard/BannerCarousel";
import { ToastProvider } from "@/components/upload/Toast";
import { AuthLegalLinks } from "@/components/auth/AuthFormParts";

interface AuthShellProps {
  breadcrumbs?: PageHeaderBreadcrumb[];
  title: string;
  description: string;
  sideTitle: string;
  sideDescription: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  /** "centered" is the Login / Sign Up pattern: centered logo + heading, legal links footer. */
  variant?: "default" | "centered";
}

export function AuthShell({
  breadcrumbs,
  title,
  description,
  sideTitle,
  sideDescription,
  children,
  footer,
  variant = "default",
}: AuthShellProps) {
  const centered = variant === "centered";

  return (
    <main className="relative min-h-screen bg-gradient-to-b from-background to-card px-6 py-6 md:py-8">
      {centered ? <BackLink /> : <TopLogo />}

      <div className="mx-auto grid w-full max-w-6xl gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <SidePanel title={sideTitle} description={sideDescription} />

        {centered ? (
          <CenteredPanel title={title} description={description} footer={footer}>
            {children}
          </CenteredPanel>
        ) : (
          <DefaultPanel
            breadcrumbs={breadcrumbs}
            title={title}
            description={description}
            footer={footer}
          >
            {children}
          </DefaultPanel>
        )}
      </div>
    </main>
  );
}

function TopLogo() {
  return (
    <div className="mx-auto flex w-full max-w-6xl items-center justify-between pb-6">
      <Link href="/" className="inline-flex items-center">
        <LogoFull iconSize={24} />
      </Link>
    </div>
  );
}

function BackLink() {
  return (
    <div className="mx-auto flex w-full max-w-6xl items-center justify-between pb-2 lg:pb-6">
      <Link
        href="/"
        aria-label="Voltar"
        className="-ml-2 inline-flex size-10 items-center justify-center text-foreground lg:hidden"
      >
        <ChevronLeft className="size-6" />
      </Link>
      <Link href="/" className="hidden items-center lg:inline-flex">
        <LogoFull iconSize={24} />
      </Link>
    </div>
  );
}

interface SidePanelProps {
  title: string;
  description: string;
}

function SidePanel({ title, description }: SidePanelProps) {
  return (
    <Card className="hidden overflow-hidden border-primary/20 bg-gradient-to-br from-primary/10 via-card to-background lg:block">
      <CardContent className="flex h-full min-h-[620px] flex-col justify-between gap-8 px-10 py-10">
        <ToastProvider>
          <BannerCarousel />
        </ToastProvider>
        <div className="max-w-lg space-y-4">
          <span className="inline-flex w-fit items-center rounded-full bg-primary/15 px-3 py-1 text-xs font-bold uppercase tracking-[0.08em] text-primary">
            Notura AI
          </span>
          <h2 className="font-display text-4xl font-extrabold leading-tight text-foreground">
            {title}
          </h2>
          <p className="text-sm leading-relaxed text-muted-foreground">{description}</p>
        </div>
      </CardContent>
    </Card>
  );
}

interface PanelProps {
  title: string;
  description: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

function CenteredPanel({ title, description, children, footer }: PanelProps) {
  return (
    <Card className="border-0 bg-transparent shadow-none lg:border lg:border-border/90 lg:bg-card">
      <CardContent className="mx-auto w-full max-w-md space-y-6 p-0 lg:p-10">
        <div className="flex justify-center pt-2">
          <LogoFull iconSize={36} />
        </div>
        <div className="space-y-2 text-center">
          <h1 className="font-display text-2xl font-bold text-foreground">{title}</h1>
          <p className="text-[15px] leading-relaxed text-muted-foreground">{description}</p>
        </div>
        {children}
        {footer}
        <AuthLegalLinks />
      </CardContent>
    </Card>
  );
}

interface DefaultPanelProps extends PanelProps {
  breadcrumbs?: PageHeaderBreadcrumb[];
}

function DefaultPanel({ breadcrumbs, title, description, children, footer }: DefaultPanelProps) {
  return (
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
  );
}
