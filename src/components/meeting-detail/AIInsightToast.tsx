"use client";

import React, { useState } from "react";
import { Sparkles, ChevronDown } from "lucide-react";

export interface AIInsightToastProps {
  message: string;
}

export function AIInsightToast({ message }: AIInsightToastProps) {
  const [expanded, setExpanded] = useState(false);

  if (!message) return null;

  return (
    <div className="fixed bottom-[5.5rem] right-7 z-40 flex flex-col items-end gap-2">
      {/* Insight panel — slides up from the FAB */}
      <div
        className="w-64 rounded-xl border border-primary/30 bg-popover/95 p-3 shadow-lg backdrop-blur-sm"
        style={{
          opacity: expanded ? 1 : 0,
          transform: expanded ? "translateY(0) scale(1)" : "translateY(8px) scale(0.96)",
          pointerEvents: expanded ? "auto" : "none",
          transition: "opacity 0.25s cubic-bezier(0.3,0,0.1,1), transform 0.25s cubic-bezier(0.3,0,0.1,1)",
          transformOrigin: "bottom right",
        }}
        aria-hidden={!expanded}
      >
        <div className="mb-1.5 flex items-center gap-1.5">
          <span className="text-xs leading-none text-primary">✦</span>
          <span className="text-[10px] font-bold uppercase tracking-[0.06em] text-primary/90">
            Dicas do Notura AI
          </span>
        </div>
        <p className="m-0 text-xs leading-relaxed text-muted-foreground">
          {message}
        </p>
      </div>

      {/* FAB */}
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-label={expanded ? "Fechar dicas" : "Ver dicas do Notura AI"}
        aria-expanded={expanded}
        className="relative flex h-[52px] w-[52px] items-center justify-center rounded-full bg-[#5341CD] text-white shadow-[0_4px_20px_rgba(83,65,205,0.45)] transition-all duration-200 hover:bg-[#4433BB] hover:shadow-[0_6px_28px_rgba(83,65,205,0.6)] active:scale-95"
      >
        <Sparkles
          style={{ width: 22, height: 22, position: "absolute",
            opacity: expanded ? 0 : 1,
            transform: expanded ? "scale(0) rotate(90deg)" : "scale(1) rotate(0deg)",
            transition: "opacity 0.2s, transform 0.2s cubic-bezier(0.3,0,0.1,1)",
          }}
        />
        <ChevronDown
          style={{ width: 22, height: 22, position: "absolute",
            opacity: expanded ? 1 : 0,
            transform: expanded ? "scale(1) rotate(0deg)" : "scale(0) rotate(-90deg)",
            transition: "opacity 0.2s, transform 0.2s cubic-bezier(0.3,0,0.1,1)",
          }}
        />
      </button>
    </div>
  );
}
