"use client";

import React from "react";

export interface AIInsightToastProps {
  userInitials: string;
  message: string;
}

export function AIInsightToast({ userInitials, message }: AIInsightToastProps) {
  return (
    <div className="fixed bottom-20 left-2 z-30 w-56 rounded-lg border border-primary/30 bg-popover/95 p-3 shadow-lg backdrop-blur-sm">
      <div className="mb-1.5 flex items-center gap-1.5">
        <span className="text-xs leading-none text-primary">✦</span>
        <span className="text-[10px] font-bold uppercase tracking-[0.06em] text-primary/90">
          AI Insight {userInitials}
        </span>
      </div>

      <p className="m-0 text-xs leading-relaxed text-muted-foreground">
        {message}
      </p>
    </div>
  );
}
