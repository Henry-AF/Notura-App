import React from "react";
import { Sparkles } from "lucide-react";

export function AiInsightTip() {
  return (
    <div
      className="relative overflow-hidden rounded-2xl border p-4"
      style={{
        background: "#1A1326",
        borderColor: "#3A2860",
      }}
    >
      {/* Gradient top border */}
      <div
        className="absolute left-0 right-0 top-0"
        style={{
          height: "2px",
          background: "linear-gradient(90deg, #6C5CE7, #BB5288)",
        }}
      />

      {/* Label */}
      <div className="flex items-center gap-1.5">
        <Sparkles className="h-3 w-3 text-[#BB5288]" />
        <span
          style={{
            fontSize: "9px",
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "0.12em",
            color: "#BB5288",
          }}
        >
          AI Insight Tip
        </span>
      </div>

      {/* Title */}
      <p className="mt-2 font-display text-sm font-bold text-white">
        Detecção Automática de Speakers
      </p>

      {/* Body */}
      <p
        className="mt-1.5 leading-relaxed text-[#A0A0A0]"
        style={{ fontSize: "12px" }}
      >
        Nossa IA agora identifica automaticamente quem está falando e separa as
        falas para uma transcrição impecável.
      </p>

      {/* Decorative mic icon */}
      <span
        className="pointer-events-none absolute bottom-3 right-3 select-none"
        style={{ fontSize: "32px", opacity: 0.25 }}
        aria-hidden="true"
      >
        🎙
      </span>
    </div>
  );
}
