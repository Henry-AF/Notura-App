"use client";

import React from "react";
import { FileAudio, X } from "lucide-react";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatFileSize(bytes: number): string {
  if (bytes < 1_048_576) return `${(bytes / 1_024).toFixed(1)} KB`;
  return `${(bytes / 1_048_576).toFixed(1)} MB`;
}

function estimateDuration(bytes: number): string {
  // Rough heuristic: ~1 MB per minute of voice audio
  const totalMinutes = Math.max(1, Math.round(bytes / 1_048_576));
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  if (h > 0) return `${h}h ${m}min`;
  return `${m} min 00 seg`;
}

// ─── Props ────────────────────────────────────────────────────────────────────

export interface UploadProgressCardProps {
  file: File;
  progress: number;       // 0–100
  timeRemaining: string;  // e.g. "12s restantes"
  onRemove: () => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function UploadProgressCard({
  file,
  progress,
  timeRemaining,
  onRemove,
}: UploadProgressCardProps) {
  const isDone = progress >= 100;

  return (
    <div className="rounded-2xl border border-[#2E2E2E] bg-[#1C1C1C] p-5">
      {/* File header */}
      <div className="flex items-start gap-3">
        {/* File icon */}
        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center"
          style={{ background: "rgba(104,81,255,0.15)", borderRadius: "10px" }}
        >
          <FileAudio className="h-5 w-5 text-[#6851FF]" />
        </div>

        {/* File info */}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-white">{file.name}</p>
          <p className="text-[12px] text-[#A0A0A0]">
            {formatFileSize(file.size)} • {estimateDuration(file.size)}
          </p>
        </div>

        {/* Remove button */}
        <button
          onClick={onRemove}
          className="shrink-0 rounded-full p-1 text-[#606060] transition-colors hover:bg-[#2E2E2E] hover:text-[#A0A0A0]"
          aria-label="Remover arquivo"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Progress bar */}
      <div className="mt-4">
        <div
          className="overflow-hidden rounded-full"
          style={{ height: "4px", background: "rgb(var(--cn-border))" }}
        >
          <div
            style={{
              width: `${Math.min(progress, 100)}%`,
              height: "100%",
              background: "linear-gradient(90deg, #6851FF, #8B7AFF)",
              borderRadius: "999px",
              transition: "width 0.4s ease",
            }}
          />
        </div>

        {/* Status label + time remaining */}
        <div className="mt-2 flex items-center justify-between gap-4">
          <span
            style={{
              color: isDone ? "#4ECB71" : "#8B7AFF",
              fontSize: "11px",
              fontWeight: 700,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
            }}
          >
            {isDone ? "CONCLUÍDO ✓" : `ENVIANDO... ${Math.round(progress)}%`}
          </span>

          {!isDone && timeRemaining && (
            <span className="text-[11px] text-[#606060]">{timeRemaining}</span>
          )}
        </div>
      </div>
    </div>
  );
}
