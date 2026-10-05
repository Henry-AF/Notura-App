"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { ChevronLeft } from "lucide-react";
import { LogoFull } from "@/components/logo";
import { cn } from "@/lib/utils";

interface FunnelLayoutProps {
  progress: number;
  canGoBack: boolean;
  onBack: () => void;
  wide?: boolean;
  children: ReactNode;
}

/** Shell shared by every funnel screen: back button, logo, progress bar and a centered column. */
export function FunnelLayout({ progress, canGoBack, onBack, wide = false, children }: FunnelLayoutProps) {
  return (
    <main className="min-h-dvh bg-gradient-to-b from-background to-card px-6 pb-10 pt-4 md:pt-8">
      <div className={cn("mx-auto w-full", wide ? "max-w-3xl" : "max-w-xl")}>
        <header className="flex items-center gap-3 pb-6">
          <button
            type="button"
            onClick={onBack}
            aria-label="Voltar"
            disabled={!canGoBack}
            className={cn(
              "-ml-2 inline-flex size-10 items-center justify-center rounded-full text-foreground transition-colors hover:bg-accent",
              !canGoBack && "invisible"
            )}
          >
            <ChevronLeft className="size-6" />
          </button>
          <Link href="/" className="mx-auto inline-flex">
            <LogoFull iconSize={24} />
          </Link>
          <span className="size-10" aria-hidden="true" />
        </header>
        <FunnelProgress value={progress} />
        <div className="animate-fade-in pt-8">{children}</div>
      </div>
    </main>
  );
}

function FunnelProgress({ value }: { value: number }) {
  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={value}
      className="h-1.5 w-full overflow-hidden rounded-full bg-primary/15"
    >
      <div
        className="h-full rounded-full bg-primary transition-all duration-500"
        style={{ width: `${value}%` }}
      />
    </div>
  );
}
