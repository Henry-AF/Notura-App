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
}

// ─── Component ────────────────────────────────────────────────────────────────

export function DropZone({ onFile, onError, compact = false }: DropZoneProps) {
  const [dragActive, setDragActive] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const validate = useCallback(
    (file: File) => {
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
    [onError]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragActive(false);
      const file = e.dataTransfer.files[0];
      if (file && validate(file)) onFile(file);
    },
    [onFile, validate]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
  }, []);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file && validate(file)) onFile(file);
    },
    [onFile, validate]
  );

  return (
    <div
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onClick={() => inputRef.current?.click()}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && inputRef.current?.click()}
      className={cn(
        "flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed text-center transition-all duration-150 focus:outline-none",
        compact ? "min-h-[180px] px-5 py-6" : "min-h-[280px] px-8 py-12",
        dragActive
          ? "border-[#6851FF] bg-[#6851FF]/[0.06]"
          : "border-[#E5E7EB] bg-white hover:border-[#6851FF]/50 hover:bg-[#6851FF]/[0.03]"
      )}
    >
      {/* Cloud icon */}
      <div
        className={cn(
          "flex items-center justify-center",
          compact ? "h-11 w-11" : "h-14 w-14"
        )}
        style={{
          background: "rgba(104,81,255,0.15)",
          borderRadius: compact ? "12px" : "14px",
        }}
      >
        <CloudUpload
          className={cn(
            "text-[#6851FF]",
            compact ? "h-5 w-5" : "h-7 w-7"
          )}
        />
      </div>

      {/* Headline */}
      <p
        className={cn(
          "font-display font-bold text-[#191c1e]",
          compact ? "mt-4 text-base" : "mt-5 text-lg"
        )}
      >
        Arraste e solte o áudio ou vídeo aqui
      </p>

      {/* Supported formats */}
      <p
        className={cn(
          "leading-relaxed text-[#6b7280]",
          compact ? "mt-1.5 text-xs" : "mt-2 text-[13px]"
        )}
      >
        Formatos suportados: MP3, WAV, M4A ou MP4.
        <br />
        Tamanho máximo: 500MB.
      </p>

      {/* Select button */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          inputRef.current?.click();
        }}
        className={cn(
          "rounded-lg border border-[#E5E7EB] bg-white font-medium text-[#4b5563] transition-all active:scale-[0.98] hover:border-[#6851FF]/40 hover:bg-[#6851FF]/[0.04]",
          compact ? "mt-4 px-4 py-2 text-xs" : "mt-6 px-6 py-2.5 text-sm"
        )}
      >
        Selecionar arquivo do computador
      </button>

      <input
        ref={inputRef}
        type="file"
        accept=".mp3,.wav,.m4a,.mp4,audio/*,video/mp4"
        onChange={handleChange}
        className="hidden"
      />
    </div>
  );
}
