"use client";

import * as React from "react";
import { Square } from "lucide-react";
import { cn } from "@/lib/utils";

interface RecordingPillProps {
  elapsedSeconds: number;
  onStop: () => void;
  className?: string;
}

function formatTimer(seconds: number): string {
  const m = Math.floor(seconds / 60).toString().padStart(2, "0");
  const s = (seconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

function RecordingPill({ elapsedSeconds, onStop, className }: RecordingPillProps) {
  return (
    <div
      className={cn(
        "fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 rounded-full bg-violet-600 px-5 py-2.5 text-white shadow-glow",
        className
      )}
    >
      <span className="relative flex h-3 w-3">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-75" />
        <span className="relative inline-flex h-3 w-3 rounded-full bg-white" />
      </span>
      <span className="text-sm font-medium">Gravando</span>
      <span className="font-mono text-sm tabular-nums">
        {formatTimer(elapsedSeconds)}
      </span>
      <button
        onClick={onStop}
        className="ml-1 flex h-7 w-7 items-center justify-center rounded-full bg-white/20 transition-colors hover:bg-white/30"
        aria-label="Parar gravacao"
      >
        <Square className="h-3.5 w-3.5 fill-white text-white" />
      </button>
    </div>
  );
}

export { RecordingPill };
