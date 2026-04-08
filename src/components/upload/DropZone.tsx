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
}

// ─── Component ────────────────────────────────────────────────────────────────

export function DropZone({ onFile, onError }: DropZoneProps) {
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
        "flex min-h-[280px] cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed px-8 py-12 text-center transition-all duration-150 focus:outline-none",
        dragActive
          ? "border-[#6851FF] bg-[#6851FF]/[0.06]"
          : "border-[#E5E7EB] bg-white hover:border-[#6851FF]/50 hover:bg-[#6851FF]/[0.03]"
      )}
    >
      {/* Cloud icon */}
      <div
        className="flex h-14 w-14 items-center justify-center"
        style={{
          background: "rgba(104,81,255,0.15)",
          borderRadius: "14px",
        }}
      >
        <CloudUpload className="h-7 w-7 text-[#6851FF]" />
      </div>

      {/* Headline */}
      <p className="mt-5 font-display text-lg font-bold text-[#191c1e]">
        Arraste e solte o áudio ou vídeo aqui
      </p>

      {/* Supported formats */}
      <p className="mt-2 text-[13px] leading-relaxed text-[#6b7280]">
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
        className="mt-6 rounded-lg border border-[#E5E7EB] bg-white px-6 py-2.5 text-sm font-medium text-[#4b5563] transition-all active:scale-[0.98] hover:border-[#6851FF]/40 hover:bg-[#6851FF]/[0.04]"
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
