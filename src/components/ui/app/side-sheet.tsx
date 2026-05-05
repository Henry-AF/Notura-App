"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";

interface AppSideSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ariaLabel: string;
  header?: React.ReactNode;
  footer?: React.ReactNode;
  children: React.ReactNode;
  panelClassName?: string;
  backdropClassName?: string;
}

export function AppSideSheet({
  open,
  onOpenChange,
  ariaLabel,
  header,
  footer,
  children,
  panelClassName,
  backdropClassName,
}: AppSideSheetProps) {
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  React.useEffect(() => {
    if (!open) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onOpenChange(false);
    }

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onOpenChange, open]);

  const sheet = (
    <>
      <div
        aria-hidden="true"
        onClick={() => onOpenChange(false)}
        className={cn(
          "fixed inset-0 z-40 bg-black/30 backdrop-blur-[2px] transition-opacity duration-300",
          open ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0",
          backdropClassName
        )}
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel}
        className={cn(
          "fixed right-0 top-0 z-50 flex h-dvh w-[420px] max-w-[100vw] flex-col bg-popover shadow-2xl transition-transform duration-300 ease-[cubic-bezier(0.3,0,0.1,1)]",
          open ? "translate-x-0" : "translate-x-full",
          panelClassName
        )}
      >
        {open ? (
          <>
            {header}
            {children}
            {footer}
          </>
        ) : null}
      </aside>
    </>
  );

  if (!mounted) return null;
  return createPortal(sheet, document.body);
}
