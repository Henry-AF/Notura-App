"use client";

import React, { useCallback, useRef, useState } from "react";
import { CloudUpload } from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Constants ────────────────────────────────────────────────────────────────

const ACCEPTED_TYPES = new Set([
  "audio/mpeg",
  "audio/mp4",
  "audio/x-m4a",
  "audio/wav",
  "audio/wave",
  "video/mp4",
]);

const ACCEPTED_EXT = /\.(mp3|wav|m4a|mp4)$/i;
const MAX_SIZE = 500 * 1024 * 1024; // 500 MB

// ─── Props ────────────────────────────────────────────────────────────────────

interface DropZoneProps {
  onFile: (file: File) => void;
  onError: (message: string) => void;
  compact?: boolean;
  disabled?: boolean;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function DropZone({
  onFile,
  onError,
  compact = false,
  disabled = false,
}: DropZoneProps) {
  const [dragActive, setDragActive] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const validate = useCallback(
    (file: File) => {
      if (disabled) return false;

      if (file.size > MAX_SIZE) {
        onError("Arquivo muito grande. Máximo 500MB.");
        return false;
      }
      if (!ACCEPTED_TYPES.has(file.type) && !ACCEPTED_EXT.test(file.name)) {
        onError("Formato não suportado. Use MP3, WAV, M4A ou MP4.");
        return false;
      }
      return true;
    },
    [disabled, onError]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragActive(false);
      if (disabled) return;
      const file = e.dataTransfer.files.item(0);
      if (file && validate(file)) onFile(file);
    },
    [disabled, onFile, validate]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (disabled) return;
    setDragActive(true);
  }, [disabled]);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
  }, []);

  const handleFileInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (disabled) return;
      const file = e.target.files?.[0];
      if (file && validate(file)) onFile(file);
    },
    [disabled, onFile, validate]
  );

  return (
    <>
      <button
        type="button"
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => {
          if (!disabled) inputRef.current?.click();
        }}
        disabled={disabled}
        aria-disabled={disabled}
        className={cn(
          "flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed text-center transition-all duration-150 focus:outline-none",
          compact ? "min-h-[180px] px-5 py-6" : "min-h-[280px] px-8 py-12",
          disabled
            ? "cursor-not-allowed border-border bg-muted/40 opacity-60"
            : dragActive
              ? "border-primary bg-primary/[0.06]"
              : "border-border bg-transparent hover:border-primary/50 hover:bg-primary/[0.03]"
        )}
      >
        <div
          className={cn(
            "flex items-center justify-center rounded-[12px] bg-primary/15",
            compact ? "h-11 w-11 rounded-xl" : "h-14 w-14 rounded-[14px]"
          )}
        >
          <CloudUpload
            className={cn("text-primary", compact ? "h-5 w-5" : "h-7 w-7")}
          />
        </div>

        <p
          className={cn(
            "font-display font-bold text-foreground",
            compact ? "mt-4 text-base" : "mt-5 text-lg"
          )}
        >
          Arraste e solte o áudio ou vídeo aqui
        </p>

        <p
          className={cn(
            "leading-relaxed text-muted-foreground",
            compact ? "mt-1.5 text-xs" : "mt-2 text-[13px]"
          )}
        >
          Formatos suportados: MP3, WAV, M4A ou MP4.
          <br />
          Tamanho máximo: 500MB.
        </p>

        <span
          className={cn(
            "rounded-lg border border-border bg-transparent font-medium text-muted-foreground transition-all active:scale-[0.98]",
            disabled
              ? "cursor-not-allowed"
              : "hover:border-primary/40 hover:bg-primary/[0.04] hover:text-foreground",
            compact ? "mt-4 px-4 py-2 text-xs" : "mt-6 px-6 py-2.5 text-sm"
          )}
        >
          Selecionar arquivo do computador
        </span>
      </button>
      <input
        ref={inputRef}
        type="file"
        aria-label="Selecionar arquivo de reunião"
        accept=".mp3,.wav,.m4a,.mp4,audio/*,video/mp4"
        onChange={handleFileInputChange}
        disabled={disabled}
        className="hidden"
      />
    </>
  );
}
