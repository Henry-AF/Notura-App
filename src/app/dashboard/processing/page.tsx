"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  FileAudio,
  Wand2,
  MessageCircle,
  CheckCircle,
  Sparkles,
  Clock,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Processing steps definition ─────────────────────────────────────────────

interface Step {
  id: string;
  icon: React.ElementType;
  label: string;
  sublabel: string;
  /** approx ms until this step completes after it becomes active */
  duration: number;
}

const STEPS: Step[] = [
  {
    id: "upload",
    icon: FileAudio,
    label: "Carregando áudio",
    sublabel: "Verificando formato e qualidade do arquivo",
    duration: 2200,
  },
  {
    id: "transcribe",
    icon: Wand2,
    label: "Transcrevendo",
    sublabel: "Convertendo fala em texto com Whisper",
    duration: 5000,
  },
  {
    id: "analyze",
    icon: Sparkles,
    label: "Analisando com IA",
    sublabel: "Identificando decisões, tarefas e resumo",
    duration: 5500,
  },
  {
    id: "whatsapp",
    icon: MessageCircle,
    label: "Enviando no WhatsApp",
    sublabel: "Entregando resumo para os participantes",
    duration: 2000,
  },
];

// ─── Waveform animation ───────────────────────────────────────────────────────

const BAR_HEIGHTS = [0.4, 0.7, 0.9, 0.55, 0.85, 0.45, 0.75, 0.6, 0.95, 0.5, 0.8, 0.65];

function AnimatedWaveform({ active }: { active: boolean }) {
  return (
    <div className="flex h-12 items-end justify-center gap-[3px]" aria-hidden>
      {BAR_HEIGHTS.map((h, i) => (
        <div
          key={i}
          className="w-[3px] rounded-full origin-bottom"
          style={{
            height: `${Math.round(h * 40 + 6)}px`,
            background: active
              ? "linear-gradient(to top, #4648d4, #6063ee)"
              : "rgba(199,196,215,0.5)",
            animation: active ? `waveBar 0.85s ease-in-out infinite alternate` : "none",
            animationDelay: `${(i * 71) % 850}ms`,
            transition: "background 0.4s ease",
          }}
        />
      ))}
      <style>{`
        @keyframes waveBar {
          0%   { transform: scaleY(0.35); }
          100% { transform: scaleY(1); }
        }
        @media (prefers-reduced-motion: reduce) {
          [style*="waveBar"] { animation: none !important; }
        }
      `}</style>
    </div>
  );
}

// ─── Spinning ring ────────────────────────────────────────────────────────────

function SpinningRing({ done }: { done: boolean }) {
  return (
    <div className="relative flex h-24 w-24 items-center justify-center sm:h-28 sm:w-28">
      {/* Track */}
      <svg
        className="absolute inset-0 h-full w-full -rotate-90"
        viewBox="0 0 100 100"
        fill="none"
      >
        <circle
          cx="50" cy="50" r="44"
          stroke="rgba(199,196,215,0.3)"
          strokeWidth="5"
        />
        {/* Animated arc */}
        <circle
          cx="50" cy="50" r="44"
          stroke="url(#ringGrad)"
          strokeWidth="5"
          strokeLinecap="round"
          strokeDasharray="276.46"
          strokeDashoffset={done ? 0 : undefined}
          className={done ? "transition-all duration-700" : "animate-spin"}
          style={
            done
              ? { strokeDashoffset: 0 }
              : {
                  strokeDasharray: "60 216.46",
                  animationDuration: "1.4s",
                  animationTimingFunction: "linear",
                }
          }
        />
        <defs>
          <linearGradient id="ringGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#4648d4" />
            <stop offset="100%" stopColor="#6063ee" />
          </linearGradient>
        </defs>
      </svg>

      {/* Center icon */}
      <div
        className={cn(
          "flex h-14 w-14 items-center justify-center rounded-full transition-all duration-500 sm:h-16 sm:w-16",
          done ? "bg-emerald-50" : "bg-[#e1e0ff]"
        )}
      >
        {done ? (
          <CheckCircle className="h-7 w-7 text-emerald-500 sm:h-8 sm:w-8" />
        ) : (
          <Sparkles className="h-7 w-7 text-[#4648d4] sm:h-8 sm:w-8" />
        )}
      </div>
    </div>
  );
}

// ─── Step row ─────────────────────────────────────────────────────────────────

type StepStatus = "pending" | "active" | "done";

function StepRow({
  step,
  status,
}: {
  step: Step;
  status: StepStatus;
}) {
  const Icon = step.icon;

  return (
    <div
      className={cn(
        "flex items-start gap-4 rounded-2xl border p-4 transition-all duration-400 sm:p-5",
        status === "active" &&
          "border-[rgba(70,72,212,0.25)] bg-[#f6f3f2] shadow-sm",
        status === "done" &&
          "border-[rgba(199,196,215,0.15)] bg-white/40",
        status === "pending" &&
          "border-[rgba(199,196,215,0.15)] bg-white/20 opacity-50"
      )}
    >
      {/* Icon bubble */}
      <div
        className={cn(
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-all duration-300 sm:h-10 sm:w-10",
          status === "done" && "bg-emerald-50",
          status === "active" && "bg-[#e1e0ff]",
          status === "pending" && "bg-[#e5e2e1]"
        )}
      >
        {status === "done" ? (
          <CheckCircle className="h-4 w-4 text-emerald-500 sm:h-5 sm:w-5" />
        ) : (
          <Icon
            className={cn(
              "h-4 w-4 sm:h-5 sm:w-5",
              status === "active" ? "text-[#4648d4]" : "text-[#464554]"
            )}
          />
        )}
      </div>

      {/* Text */}
      <div className="min-w-0 flex-1 pt-0.5">
        <p
          className={cn(
            "text-sm font-semibold transition-colors duration-200",
            status === "done" && "text-emerald-700",
            status === "active" && "text-[#1c1b1b]",
            status === "pending" && "text-[#464554]"
          )}
        >
          {step.label}
          {status === "active" && (
            <span className="ml-1 inline-flex gap-0.5">
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  className="inline-block h-1 w-1 rounded-full bg-[#4648d4]"
                  style={{
                    animation: "dotBounce 1.2s ease-in-out infinite",
                    animationDelay: `${i * 0.2}s`,
                  }}
                />
              ))}
            </span>
          )}
        </p>
        <p
          className={cn(
            "mt-0.5 text-xs leading-relaxed transition-colors duration-200",
            status === "active" ? "text-[#464554]" : "text-[#464554]/60"
          )}
        >
          {step.sublabel}
        </p>
      </div>

      {/* Right — status chip */}
      <div className="shrink-0">
        {status === "done" && (
          <span className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-medium text-emerald-700">
            Concluído
          </span>
        )}
        {status === "active" && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[#e1e0ff] px-2.5 py-1 text-[11px] font-medium text-[#07006c]">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute h-full w-full animate-ping rounded-full bg-[#4648d4] opacity-60" />
              <span className="h-1.5 w-1.5 rounded-full bg-[#4648d4]" />
            </span>
            Em curso
          </span>
        )}
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ProcessingPage() {
  const [currentStep, setCurrentStep] = useState(0);
  const [done, setDone] = useState(false);
  const [elapsed, setElapsed] = useState(0);

  // Advance through steps
  useEffect(() => {
    if (currentStep >= STEPS.length) {
      setDone(true);
      return;
    }
    const t = setTimeout(() => {
      setCurrentStep((s) => s + 1);
    }, STEPS[currentStep].duration);
    return () => clearTimeout(t);
  }, [currentStep]);

  // Wall-clock elapsed counter
  useEffect(() => {
    if (done) return;
    const t = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [done]);

  const elapsedStr = (() => {
    const m = Math.floor(elapsed / 60);
    const s = elapsed % 60;
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  })();

  // Progress fraction across the whole pipeline
  const progress = done
    ? 100
    : Math.min(
        Math.round(
          ((currentStep +
            // partial credit: not possible to know exact sub-progress, use 0.5 fudge
            0) /
            STEPS.length) *
            100
        ),
        99
      );

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      {/* ── Back nav ───────────────────────────────────────────────────────── */}
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
          <p className="mt-0.5 text-xs text-[#464554]">
            Reunião gravada · 47 min
          </p>
        </div>
      </div>

      {/* ── Hero card ──────────────────────────────────────────────────────── */}
      <div
        className={cn(
          "relative overflow-hidden rounded-2xl border px-6 py-10 text-center transition-all duration-700 sm:px-10 sm:py-12",
          done
            ? "border-emerald-200 bg-emerald-50/50"
            : "border-[rgba(70,72,212,0.2)] bg-[#f6f3f2]"
        )}
      >
        {/* Background glow */}
        <div
          className="pointer-events-none absolute -top-16 left-1/2 h-64 w-64 -translate-x-1/2 rounded-full blur-3xl transition-colors duration-700"
          style={{
            background: done
              ? "rgba(16,185,129,0.07)"
              : "rgba(70,72,212,0.08)",
          }}
        />

        <div className="relative z-10 flex flex-col items-center gap-6">
          {/* Spinning ring / done state */}
          <SpinningRing done={done} />

          {/* Headline */}
          {done ? (
            <>
              <div>
                <h2 className="font-manrope font-extrabold text-2xl tracking-[-0.4px] text-[#1c1b1b] sm:text-3xl">
                  Pronto! 🎉
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-[#464554]">
                  Resumo gerado e enviado via WhatsApp com sucesso.
                </p>
              </div>

              {/* Metrics row */}
              <div className="flex flex-wrap items-center justify-center gap-4">
                {[
                  { label: "Tarefas extraídas", value: "7" },
                  { label: "Decisões", value: "4" },
                  { label: "Tempo de processamento", value: elapsedStr },
                ].map((m) => (
                  <div
                    key={m.label}
                    className="flex flex-col items-center rounded-xl border border-[rgba(199,196,215,0.3)] bg-white px-5 py-3"
                  >
                    <span className="font-manrope font-extrabold text-xl text-[#1c1b1b]">
                      {m.value}
                    </span>
                    <span className="mt-0.5 text-xs text-[#464554]">
                      {m.label}
                    </span>
                  </div>
                ))}
              </div>

              {/* CTA */}
              <div className="flex flex-wrap items-center justify-center gap-3">
                <Link href="/dashboard/meetings/m1">
                  <button
                    className="inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-medium text-white transition-all hover:opacity-90"
                    style={{
                      background: "linear-gradient(135deg, #4648d4, #6063ee)",
                      boxShadow:
                        "0 10px 15px -3px rgba(70,72,212,0.2), 0 4px 6px -4px rgba(70,72,212,0.2)",
                    }}
                  >
                    <Sparkles className="h-4 w-4" />
                    Ver resumo
                  </button>
                </Link>
                <Link href="/dashboard">
                  <button className="inline-flex items-center gap-2 rounded-full border border-[rgba(199,196,215,0.4)] bg-white px-5 py-2.5 text-sm font-medium text-[#464554] transition-colors hover:bg-[#f6f3f2]">
                    Ir para reuniões
                  </button>
                </Link>
              </div>
            </>
          ) : (
            <>
              <div>
                <h2 className="font-manrope font-extrabold text-2xl tracking-[-0.4px] text-[#1c1b1b] sm:text-3xl">
                  Processando insights com IA
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-[#464554]">
                  Isso geralmente leva de 2 a 5 minutos. Pode fechar esta
                  aba — você será notificado quando estiver pronto.
                </p>
              </div>

              {/* Progress bar */}
              <div className="w-full max-w-xs">
                <div className="mb-2 flex items-center justify-between text-xs text-[#464554]">
                  <span>
                    {currentStep < STEPS.length
                      ? STEPS[currentStep].label
                      : "Finalizando..."}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {elapsedStr}
                  </span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#e5e2e1]">
                  <div
                    className="h-1.5 rounded-full transition-all duration-700 ease-out"
                    style={{
                      width: `${progress}%`,
                      background: "linear-gradient(90deg, #4648d4, #6063ee)",
                    }}
                  />
                </div>
              </div>

              {/* Waveform */}
              <AnimatedWaveform active={true} />
            </>
          )}
        </div>
      </div>

      {/* ── Step list ──────────────────────────────────────────────────────── */}
      <div className="space-y-3">
        <h3 className="font-manrope font-extrabold tracking-[-0.2px] text-[#1c1b1b]">
          Etapas do processamento
        </h3>

        <div className="space-y-2.5">
          {STEPS.map((step, i) => {
            const status: StepStatus =
              i < currentStep ? "done" : i === currentStep ? "active" : "pending";
            // After all steps complete, mark all as done
            const finalStatus: StepStatus = done ? "done" : status;
            return (
              <StepRow key={step.id} step={step} status={finalStatus} />
            );
          })}
        </div>
      </div>

      {/* ── Info note ──────────────────────────────────────────────────────── */}
      {!done && (
        <p className="text-center text-xs leading-relaxed text-[#464554]">
          O processamento ocorre em segundo plano. Você receberá o resumo no
          WhatsApp assim que estiver pronto, mesmo que feche esta página.
        </p>
      )}

      {/* Shared keyframes */}
      <style>{`
        @keyframes dotBounce {
          0%, 80%, 100% { transform: translateY(0); opacity: 0.4; }
          40%            { transform: translateY(-3px); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
