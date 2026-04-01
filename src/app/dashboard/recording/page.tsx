"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Square,
  Pause,
  Play,
  Mic,
  Users,
  Phone,
  ChevronDown,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatTime(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  if (h > 0) {
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

// ─── Waveform ─────────────────────────────────────────────────────────────────

const BAR_COUNT = 32;

// Each bar has a fixed random height multiplier so hydration is stable
const BAR_HEIGHTS = [
  0.35, 0.6, 0.85, 0.5, 0.75, 0.4, 0.9, 0.65, 0.45, 0.8, 0.55, 0.7,
  0.3, 0.95, 0.6, 0.4, 0.75, 0.5, 0.85, 0.45, 0.65, 0.8, 0.35, 0.9,
  0.55, 0.7, 0.4, 0.6, 0.85, 0.5, 0.75, 0.4,
];

function Waveform({ active }: { active: boolean }) {
  return (
    <div className="flex h-16 items-end justify-center gap-[3px]" aria-hidden>
      {BAR_HEIGHTS.map((h, i) => (
        <div
          key={i}
          className={cn(
            "w-[3px] rounded-full origin-bottom transition-opacity duration-300",
            active ? "opacity-100" : "opacity-30"
          )}
          style={{
            height: `${Math.round(h * 56 + 8)}px`,
            background: active
              ? "linear-gradient(to top, #4648d4, #6063ee)"
              : "#c7c4d7",
            animation: active
              ? `waveBar 0.9s ease-in-out infinite alternate`
              : "none",
            animationDelay: `${(i * 37) % 900}ms`,
          }}
        />
      ))}

      <style>{`
        @keyframes waveBar {
          0%   { transform: scaleY(0.4); }
          100% { transform: scaleY(1); }
        }
        @media (prefers-reduced-motion: reduce) {
          [style*="waveBar"] { animation: none !important; }
        }
      `}</style>
    </div>
  );
}

// ─── Live Transcript Feed ─────────────────────────────────────────────────────

interface TranscriptLine {
  id: number;
  speaker: string;
  text: string;
  initials: string;
  color: string;
}

const TRANSCRIPT_SEED: Omit<TranscriptLine, "id">[] = [
  {
    speaker: "Henry Mano",
    text: "Bom, vamos começar falando sobre o roadmap do segundo trimestre.",
    initials: "HM",
    color: "#e1e0ff",
  },
  {
    speaker: "Carla Mendes",
    text: "Concordo. Acho que precisamos priorizar a migração de API antes de qualquer nova feature.",
    initials: "CM",
    color: "#fef3c7",
  },
  {
    speaker: "Marcos Andrade",
    text: "Faz sentido. Qual é o prazo que vocês têm em mente para a migração?",
    initials: "MA",
    color: "#d1fae5",
  },
  {
    speaker: "Henry Mano",
    text: "Estamos pensando nas próximas 6 semanas, com deploy incremental para minimizar risco.",
    initials: "HM",
    color: "#e1e0ff",
  },
  {
    speaker: "Carla Mendes",
    text: "Perfeito. E quem vai liderar a parte de testes de integração?",
    initials: "CM",
    color: "#fef3c7",
  },
  {
    speaker: "Marcos Andrade",
    text: "Eu posso assumir isso junto com a Julia. Já conversamos sobre a abordagem.",
    initials: "MA",
    color: "#d1fae5",
  },
];

function LiveTranscript({ active }: { active: boolean }) {
  const [lines, setLines] = useState<TranscriptLine[]>(
    TRANSCRIPT_SEED.slice(0, 2).map((l, i) => ({ ...l, id: i }))
  );
  const [nextIndex, setNextIndex] = useState(2);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!active) return;
    const interval = setInterval(() => {
      setLines((prev) => {
        const seed = TRANSCRIPT_SEED[nextIndex % TRANSCRIPT_SEED.length];
        const newLine: TranscriptLine = { ...seed, id: Date.now() };
        const updated = [...prev, newLine].slice(-12); // keep last 12
        return updated;
      });
      setNextIndex((n) => n + 1);
    }, 4500);
    return () => clearInterval(interval);
  }, [active, nextIndex]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [lines]);

  return (
    <div className="relative h-full overflow-hidden">
      {/* Top fade gradient */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-8 bg-gradient-to-b from-[#f6f3f2] to-transparent" />

      <div className="h-full overflow-y-auto px-1 pb-2 pt-4">
        <div className="space-y-4">
          {lines.map((line, i) => (
            <div
              key={line.id}
              className={cn(
                "flex items-start gap-3 transition-all duration-500",
                i === lines.length - 1 && active
                  ? "opacity-100"
                  : "opacity-70"
              )}
            >
              {/* Avatar */}
              <div
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold text-[#07006c]"
                style={{ backgroundColor: line.color }}
              >
                {line.initials}
              </div>

              {/* Bubble */}
              <div className="min-w-0 flex-1">
                <p className="mb-0.5 text-[11px] font-semibold text-[#4648d4]">
                  {line.speaker}
                </p>
                <p className="text-sm leading-relaxed text-[#1c1b1b]">
                  {line.text}
                </p>
              </div>
            </div>
          ))}

          {/* Typing indicator */}
          {active && (
            <div className="flex items-center gap-2 pl-10">
              <div className="flex items-center gap-1">
                {[0, 1, 2].map((i) => (
                  <div
                    key={i}
                    className="h-1.5 w-1.5 rounded-full bg-[#4648d4]"
                    style={{
                      animation: "typingDot 1.2s ease-in-out infinite",
                      animationDelay: `${i * 0.2}s`,
                    }}
                  />
                ))}
              </div>
              <span className="text-[11px] text-[#464554]">transcrevendo...</span>
            </div>
          )}

          <div ref={bottomRef} />
        </div>
      </div>

      <style>{`
        @keyframes typingDot {
          0%, 80%, 100% { transform: scale(0.6); opacity: 0.4; }
          40% { transform: scale(1); opacity: 1; }
        }
      `}</style>
    </div>
  );
}

// ─── Participants ─────────────────────────────────────────────────────────────

const participants = [
  { name: "Henry Mano", initials: "HM", color: "#e1e0ff", speaking: true },
  { name: "Carla Mendes", initials: "CM", color: "#fef3c7", speaking: false },
  { name: "Marcos Andrade", initials: "MA", color: "#d1fae5", speaking: false },
];

// ─── Stop Confirmation Dialog ─────────────────────────────────────────────────

function StopDialog({
  onConfirm,
  onCancel,
}: {
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onCancel}
      />
      <div className="relative z-10 w-full max-w-sm rounded-t-2xl bg-white p-6 shadow-xl sm:rounded-2xl">
        {/* Icon */}
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-50">
          <Square className="h-6 w-6 text-red-500" />
        </div>

        <h2 className="text-center font-manrope font-extrabold text-lg tracking-[-0.3px] text-[#1c1b1b]">
          Encerrar gravação?
        </h2>
        <p className="mt-2 text-center text-sm leading-relaxed text-[#464554]">
          A reunião será processada e o resumo enviado via WhatsApp para os
          contatos selecionados.
        </p>

        <div className="mt-6 flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 rounded-full border border-[rgba(199,196,215,0.4)] py-2.5 text-sm font-medium text-[#464554] transition-colors hover:bg-[#f6f3f2]"
          >
            Continuar
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 rounded-full bg-red-500 py-2.5 text-sm font-medium text-white transition-colors hover:bg-red-600"
          >
            Encerrar
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function RecordingPage() {
  const [elapsed, setElapsed] = useState(0);
  const [paused, setPaused] = useState(false);
  const [showStop, setShowStop] = useState(false);
  const [stopped, setStopped] = useState(false);
  const [transcriptOpen, setTranscriptOpen] = useState(true);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Timer
  useEffect(() => {
    if (paused || stopped) return;
    intervalRef.current = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [paused, stopped]);

  const handleStop = useCallback(() => {
    setStopped(true);
    setShowStop(false);
    if (intervalRef.current) clearInterval(intervalRef.current);
  }, []);

  const isActive = !paused && !stopped;

  return (
    <>
      <div className="space-y-6">
        {/* ── Page header ──────────────────────────────────────────────────── */}
        <div className="flex items-center gap-3">
          <Link href="/dashboard">
            <button className="flex h-9 w-9 items-center justify-center rounded-full bg-[#e5e2e1] text-[#464554] transition-colors hover:bg-[#d9d5d3]">
              <ArrowLeft className="h-4 w-4" />
            </button>
          </Link>
          <div className="min-w-0 flex-1">
            <h1 className="truncate font-manrope font-extrabold text-xl tracking-[-0.3px] text-[#1c1b1b] sm:text-2xl">
              Sprint planning — Projeto Nova Plataforma
            </h1>
          </div>
        </div>

        {/* ── Main card ────────────────────────────────────────────────────── */}
        <div
          className={cn(
            "relative overflow-hidden rounded-2xl border transition-all duration-500",
            isActive
              ? "border-[rgba(70,72,212,0.25)] bg-[#f6f3f2]"
              : stopped
              ? "border-[rgba(199,196,215,0.2)] bg-[#f6f3f2] opacity-70"
              : "border-[rgba(199,196,215,0.3)] bg-[#f6f3f2]"
          )}
        >
          {/* Subtle glow backdrop when active */}
          {isActive && (
            <div
              className="pointer-events-none absolute -top-20 left-1/2 h-64 w-64 -translate-x-1/2 rounded-full blur-3xl"
              style={{ background: "rgba(70,72,212,0.07)" }}
            />
          )}

          <div className="relative z-10 flex flex-col items-center px-6 pb-10 pt-10 sm:px-10">
            {/* ── Status badge ───────────────────────────────────────────── */}
            <div className="mb-8">
              {stopped ? (
                <span className="inline-flex items-center gap-2 rounded-full bg-[#e5e2e1] px-4 py-1.5 text-sm font-medium text-[#464554]">
                  <span className="h-2 w-2 rounded-full bg-[#464554]" />
                  Gravação encerrada
                </span>
              ) : paused ? (
                <span className="inline-flex items-center gap-2 rounded-full bg-amber-50 px-4 py-1.5 text-sm font-medium text-amber-700">
                  <span className="h-2 w-2 rounded-full bg-amber-500" />
                  Pausado
                </span>
              ) : (
                <span className="inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-medium text-white"
                  style={{ background: "linear-gradient(135deg, #4648d4, #6063ee)" }}>
                  {/* Pulsing dot */}
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-60" />
                    <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-white" />
                  </span>
                  Gravando
                </span>
              )}
            </div>

            {/* ── Timer ──────────────────────────────────────────────────── */}
            <div
              className="mb-2 tabular-nums font-manrope font-extrabold tracking-tight text-[#1c1b1b]"
              style={{ fontSize: "clamp(3rem, 10vw, 5.5rem)", lineHeight: 1 }}
            >
              {formatTime(elapsed)}
            </div>
            <p className="mb-10 text-sm text-[#464554]">
              {stopped
                ? "Processando em breve..."
                : paused
                ? "Grave para continuar a reunião"
                : "Áudio sendo processado em tempo real"}
            </p>

            {/* ── Waveform ───────────────────────────────────────────────── */}
            <div className="mb-10 w-full max-w-sm">
              <Waveform active={isActive} />
            </div>

            {/* ── Controls ───────────────────────────────────────────────── */}
            {!stopped ? (
              <div className="flex items-center gap-4">
                {/* Pause / Resume */}
                <button
                  onClick={() => setPaused((v) => !v)}
                  className="flex h-12 w-12 items-center justify-center rounded-full border border-[rgba(199,196,215,0.4)] bg-white text-[#464554] shadow-sm transition-all hover:bg-[#f6f3f2] hover:text-[#1c1b1b] active:scale-95"
                  title={paused ? "Retomar" : "Pausar"}
                >
                  {paused ? (
                    <Play className="h-5 w-5 translate-x-0.5" />
                  ) : (
                    <Pause className="h-5 w-5" />
                  )}
                </button>

                {/* Stop */}
                <button
                  onClick={() => setShowStop(true)}
                  className="flex h-16 w-16 items-center justify-center rounded-full bg-red-500 text-white shadow-lg transition-all hover:bg-red-600 active:scale-95"
                  style={{
                    boxShadow: "0 8px 20px -4px rgba(239,68,68,0.4)",
                  }}
                  title="Encerrar gravação"
                >
                  <Square className="h-6 w-6 fill-white" />
                </button>

                {/* Mic indicator */}
                <div className="flex h-12 w-12 items-center justify-center rounded-full border border-[rgba(199,196,215,0.4)] bg-white text-[#464554] shadow-sm">
                  <Mic className={cn("h-5 w-5", isActive && "text-[#4648d4]")} />
                </div>
              </div>
            ) : (
              /* Stopped — redirect hint */
              <Link href="/dashboard">
                <button
                  className="inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-medium text-white transition-all hover:opacity-90"
                  style={{
                    background: "linear-gradient(135deg, #4648d4, #6063ee)",
                    boxShadow:
                      "0 10px 15px -3px rgba(70,72,212,0.2), 0 4px 6px -4px rgba(70,72,212,0.2)",
                  }}
                >
                  Ver reuniões
                </button>
              </Link>
            )}
          </div>
        </div>

        {/* ── Two-column grid (participants + transcript) ───────────────────── */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
          {/* Participants card */}
          <div className="rounded-2xl border border-[rgba(199,196,215,0.2)] bg-[#f6f3f2] p-5 lg:col-span-2">
            <div className="mb-4 flex items-center gap-2.5">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#e1e0ff]">
                <Users className="h-4 w-4 text-[#4648d4]" />
              </div>
              <h2 className="font-manrope font-extrabold tracking-[-0.2px] text-[#1c1b1b]">
                Participantes
              </h2>
              <span className="ml-auto inline-flex items-center rounded-full bg-[#e1e0ff] px-2.5 py-0.5 text-xs font-medium text-[#07006c]">
                {participants.length}
              </span>
            </div>

            <ul className="space-y-2.5">
              {participants.map((p) => (
                <li
                  key={p.name}
                  className="flex items-center gap-3 rounded-xl bg-white px-3 py-2.5"
                >
                  <div className="relative">
                    <div
                      className="flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold text-[#07006c]"
                      style={{ backgroundColor: p.color }}
                    >
                      {p.initials}
                    </div>
                    {isActive && p.speaking && (
                      <span className="absolute -bottom-0.5 -right-0.5 flex h-3 w-3 items-center justify-center rounded-full bg-white">
                        <span className="h-2 w-2 animate-ping rounded-full bg-[#4648d4] opacity-75" />
                      </span>
                    )}
                  </div>
                  <span className="flex-1 text-sm text-[#1c1b1b]">
                    {p.name}
                  </span>
                  {isActive && p.speaking && (
                    <span className="text-[10px] font-medium text-[#4648d4]">
                      Falando
                    </span>
                  )}
                </li>
              ))}
            </ul>

            {/* WhatsApp delivery target */}
            <div className="mt-5 border-t border-[rgba(199,196,215,0.3)] pt-4">
              <p className="mb-2 text-xs font-medium text-[#464554]">
                Resumo será enviado para
              </p>
              <div className="flex items-center gap-2.5 rounded-xl bg-white px-3 py-2.5">
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-50">
                  <Phone className="h-3.5 w-3.5 text-emerald-600" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-[#1c1b1b]">
                    Henry Mano
                  </p>
                  <p className="text-[11px] text-[#464554]">
                    +55 (11) 9 9988-7766
                  </p>
                </div>
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  WhatsApp
                </span>
              </div>
            </div>
          </div>

          {/* Live transcript card */}
          <div className="rounded-2xl border border-[rgba(199,196,215,0.2)] bg-[#f6f3f2] lg:col-span-3">
            {/* Header */}
            <button
              onClick={() => setTranscriptOpen((v) => !v)}
              className="flex w-full items-center gap-2.5 p-5"
            >
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#e1e0ff]">
                <Mic className="h-4 w-4 text-[#4648d4]" />
              </div>
              <h2 className="flex-1 text-left font-manrope font-extrabold tracking-[-0.2px] text-[#1c1b1b]">
                Transcrição ao vivo
              </h2>

              {isActive && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-[#e1e0ff] px-2.5 py-1 text-xs font-medium text-[#07006c]">
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="absolute h-full w-full animate-ping rounded-full bg-[#4648d4] opacity-60" />
                    <span className="h-1.5 w-1.5 rounded-full bg-[#4648d4]" />
                  </span>
                  Ao vivo
                </span>
              )}

              <ChevronDown
                className={cn(
                  "ml-1 h-4 w-4 shrink-0 text-[#464554] transition-transform duration-200",
                  transcriptOpen && "rotate-180"
                )}
              />
            </button>

            {/* Transcript body */}
            {transcriptOpen && (
              <div className="h-72 border-t border-[rgba(199,196,215,0.2)] px-5 py-4">
                <LiveTranscript active={isActive} />
              </div>
            )}
          </div>
        </div>

        {/* ── Recording tips ────────────────────────────────────────────────── */}
        {!stopped && (
          <p className="text-center text-xs text-[#464554]">
            Mantenha a guia aberta para garantir a gravação contínua. O resumo será
            gerado automaticamente ao encerrar.
          </p>
        )}
      </div>

      {/* ── Stop confirmation dialog ────────────────────────────────────────── */}
      {showStop && (
        <StopDialog onConfirm={handleStop} onCancel={() => setShowStop(false)} />
      )}
    </>
  );
}
