"use client";

import React, { Suspense, useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  FileAudio,
  Wand2,
  MessageCircle,
  CheckCircle,
  Sparkles,
  Clock,
  AlertTriangle,
} from "lucide-react";
import { PageHeader } from "@/components/ui/app";
import { cn } from "@/lib/utils";
import { fetchMeetingStatus } from "./processing-api";

// ─── Processing steps ─────────────────────────────────────────────────────────

interface Step {
  id: string;
  icon: React.ElementType;
  label: string;
  sublabel: string;
  /** min ms before advancing to next step (fallback timer) */
  minMs: number;
}

const STEPS: Step[] = [
  {
    id: "upload",
    icon: FileAudio,
    label: "Áudio recebido",
    sublabel: "Arquivo enviado e armazenado com segurança",
    minMs: 1500,
  },
  {
    id: "transcribe",
    icon: Wand2,
    label: "Transcrevendo",
    sublabel: "Convertendo fala em texto com AssemblyAI",
    minMs: 20000,
  },
  {
    id: "analyze",
    icon: Sparkles,
    label: "Analisando com IA",
    sublabel: "Identificando decisões, tarefas e resumo",
    minMs: 15000,
  },
  {
    id: "whatsapp",
    icon: MessageCircle,
    label: "Enviando no WhatsApp",
    sublabel: "Entregando resumo para você",
    minMs: 3000,
  },
];

function LoadingState() {
  return (
    <div className="flex items-center justify-center py-20">
      <div
        style={{
          width: 36,
          height: 36,
          borderRadius: "50%",
          border: "2px solid #6851FF",
          borderTopColor: "transparent",
          animation: "spin 0.7s linear infinite",
        }}
      />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

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
              ? "linear-gradient(to top, #6851FF, #8B7AFF)"
              : "rgba(58,61,74,0.5)",
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
      `}</style>
    </div>
  );
}

// ─── Spinning ring ────────────────────────────────────────────────────────────

function SpinningRing({ done }: { done: boolean }) {
  return (
    <div className="relative flex h-24 w-24 items-center justify-center sm:h-28 sm:w-28">
      <svg
        className="absolute inset-0 h-full w-full -rotate-90"
        viewBox="0 0 100 100"
        fill="none"
      >
        <circle cx="50" cy="50" r="44" stroke="rgba(58,61,74,0.4)" strokeWidth="5" />
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
            <stop offset="0%" stopColor="#6851FF" />
            <stop offset="100%" stopColor="#8B7AFF" />
          </linearGradient>
        </defs>
      </svg>
      <div
        className={cn(
          "flex h-14 w-14 items-center justify-center rounded-full transition-all duration-500 sm:h-16 sm:w-16",
          done ? "bg-notura-success/15" : "bg-notura-primary/15"
        )}
      >
        {done ? (
          <CheckCircle className="h-7 w-7 text-notura-success sm:h-8 sm:w-8" />
        ) : (
          <Sparkles className="h-7 w-7 text-notura-primary sm:h-8 sm:w-8" />
        )}
      </div>
    </div>
  );
}

// ─── Step row ─────────────────────────────────────────────────────────────────

type StepStatus = "pending" | "active" | "done";

function StepRow({ step, status }: { step: Step; status: StepStatus }) {
  const Icon = step.icon;
  return (
    <div
      className={cn(
        "flex items-start gap-4 rounded-2xl border p-4 transition-all duration-400 sm:p-5",
        status === "active" && "border-notura-primary/25 bg-notura-surface shadow-sm",
        status === "done"   && "border-notura-border/15 bg-notura-surface/40",
        status === "pending"&& "border-notura-border/15 bg-notura-surface/20 opacity-50"
      )}
    >
      <div
        className={cn(
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-all duration-300 sm:h-10 sm:w-10",
          status === "done"    && "bg-notura-success/15",
          status === "active"  && "bg-notura-primary/15",
          status === "pending" && "bg-notura-surface"
        )}
      >
        {status === "done" ? (
          <CheckCircle className="h-4 w-4 text-notura-success sm:h-5 sm:w-5" />
        ) : (
          <Icon
            className={cn(
              "h-4 w-4 sm:h-5 sm:w-5",
              status === "active" ? "text-notura-primary" : "text-notura-ink-secondary"
            )}
          />
        )}
      </div>

      <div className="min-w-0 flex-1 pt-0.5">
        <p
          className={cn(
            "text-sm font-semibold transition-colors duration-200",
            status === "done"    && "text-notura-success",
            status === "active"  && "text-notura-ink",
            status === "pending" && "text-notura-ink-secondary"
          )}
        >
          {step.label}
          {status === "active" && (
            <span className="ml-1 inline-flex gap-0.5">
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  className="inline-block h-1 w-1 rounded-full bg-notura-primary"
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
            status === "active" ? "text-notura-ink-secondary" : "text-notura-ink-secondary/60"
          )}
        >
          {step.sublabel}
        </p>
      </div>

      <div className="shrink-0">
        {status === "done" && (
          <span className="inline-flex items-center rounded-full bg-notura-success/15 px-2.5 py-1 text-[11px] font-medium text-notura-success">
            Concluído
          </span>
        )}
        {status === "active" && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-notura-primary/15 px-2.5 py-1 text-[11px] font-medium text-notura-primary">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute h-full w-full animate-ping rounded-full bg-notura-primary opacity-60" />
              <span className="h-1.5 w-1.5 rounded-full bg-notura-primary" />
            </span>
            Em curso
          </span>
        )}
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

interface MeetingMeta {
  title: string | null;
  taskCount: number;
  decisionCount: number;
}

function ProcessingPageContent() {
  const router = useRouter();
  const params = useSearchParams();
  const meetingId = params.get("id");

  const [currentStep, setCurrentStep] = useState(0);
  const [done, setDone] = useState(false);
  const [failed, setFailed] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [meta, setMeta] = useState<MeetingMeta>({ title: null, taskCount: 0, decisionCount: 0 });

  // Step timer — advances through steps at minimum intervals as a fallback UX
  const stepTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (done || failed || currentStep >= STEPS.length) return;
    stepTimerRef.current = setTimeout(() => {
      setCurrentStep((s) => s + 1);
    }, STEPS[currentStep].minMs);
    return () => {
      if (stepTimerRef.current) clearTimeout(stepTimerRef.current);
    };
  }, [currentStep, done, failed]);

  // Wall-clock elapsed counter
  useEffect(() => {
    if (done || failed) return;
    const t = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [done, failed]);

  // Poll meeting status from Supabase every 4 seconds
  useEffect(() => {
    if (!meetingId || done || failed) return;

    const currentMeetingId = meetingId;
    let cancelled = false;

    async function poll() {
      if (cancelled) return;
      try {
        const data = await fetchMeetingStatus(currentMeetingId);
        if (cancelled) return;

        if (data.status === "completed") {
          // Mark all steps done
          setCurrentStep(STEPS.length);
          setDone(true);
          setMeta({
            title: data.title ?? null,
            taskCount: data.taskCount,
            decisionCount: data.decisionCount,
          });
          // Navigate after a short celebration delay
          setTimeout(() => {
            router.push(`/dashboard/meetings/${currentMeetingId}`);
          }, 3000);
        } else if (data.status === "failed") {
          setFailed(true);
        } else if (data.status === "processing") {
          // Ensure we're at least on step 1 (transcribing)
          setCurrentStep((prev) => Math.max(prev, 1));
        }
      } catch {
        // ignore transient network errors
      }
    }

    void poll();
    const interval = setInterval(poll, 4000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [meetingId, done, failed, router]);

  const elapsedStr = (() => {
    const m = Math.floor(elapsed / 60);
    const s = elapsed % 60;
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  })();

  const progress = done
    ? 100
    : Math.min(Math.round((currentStep / STEPS.length) * 100), 99);

  // ── Error state ───────────────────────────────────────────────────────────

  if (failed) {
    return (
      <div className="mx-auto flex max-w-lg flex-col items-center gap-6 py-20 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-500/10">
          <AlertTriangle className="h-8 w-8 text-red-400" />
        </div>
        <div>
          <h2 className="font-manrope font-extrabold text-xl text-notura-ink">
            Erro no processamento
          </h2>
          <p className="mt-2 text-sm text-notura-ink-secondary">
            Ocorreu um erro ao processar sua reunião. Tente novamente ou entre
            em contato com o suporte.
          </p>
        </div>
        <div className="flex gap-3">
          <Link href="/dashboard/new">
            <button
              className="inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-medium text-white"
              style={{ background: "linear-gradient(135deg, #6851FF, #8B7AFF)" }}
            >
              Tentar novamente
            </button>
          </Link>
          <Link href="/dashboard">
            <button className="inline-flex items-center rounded-full border border-notura-border/40 bg-notura-surface px-5 py-2.5 text-sm font-medium text-notura-ink-secondary transition-colors hover:bg-notura-surface-2">
              Ir para dashboard
            </button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <PageHeader
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Reuniões", href: "/dashboard/meetings" },
          { label: "Processando" },
        ]}
        title={meta.title ?? "Processando reunião..."}
        description="Análise em andamento"
        titleClassName="truncate"
      />

      {/* ── Hero card ──────────────────────────────────────────────────────── */}
      <div
        className={cn(
          "relative overflow-hidden rounded-2xl border px-6 py-10 text-center transition-all duration-700 sm:px-10 sm:py-12",
          done
            ? "border-notura-success/30 bg-notura-success/5"
            : "border-notura-primary/20 bg-notura-surface"
        )}
      >
        <div
          className="pointer-events-none absolute -top-16 left-1/2 h-64 w-64 -translate-x-1/2 rounded-full blur-3xl transition-colors duration-700"
          style={{
            background: done
              ? "rgba(34,197,94,0.07)"
              : "rgba(104,81,255,0.08)",
          }}
        />

        <div className="relative z-10 flex flex-col items-center gap-6">
          <SpinningRing done={done} />

          {done ? (
            <>
              <div>
                <h2 className="font-manrope font-extrabold text-2xl tracking-[-0.4px] text-notura-ink sm:text-3xl">
                  Pronto! 🎉
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-notura-ink-secondary">
                  Resumo gerado e enviado via WhatsApp. Redirecionando...
                </p>
              </div>

              <div className="flex flex-wrap items-center justify-center gap-4">
                {[
                  { label: "Tarefas extraídas", value: String(meta.taskCount) },
                  { label: "Decisões", value: String(meta.decisionCount) },
                  { label: "Tempo de processamento", value: elapsedStr },
                ].map((m) => (
                  <div
                    key={m.label}
                    className="flex flex-col items-center rounded-xl border border-notura-border/30 bg-notura-surface px-5 py-3"
                  >
                    <span className="font-manrope font-extrabold text-xl text-notura-ink">
                      {m.value}
                    </span>
                    <span className="mt-0.5 text-xs text-notura-ink-secondary">
                      {m.label}
                    </span>
                  </div>
                ))}
              </div>

              <div className="flex flex-wrap items-center justify-center gap-3">
                <Link href={`/dashboard/meetings/${meetingId}`}>
                  <button
                    className="inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-medium text-white transition-all hover:opacity-90"
                    style={{
                      background: "linear-gradient(135deg, #6851FF, #8B7AFF)",
                      boxShadow: "0 10px 15px -3px rgba(104,81,255,0.2), 0 4px 6px -4px rgba(104,81,255,0.2)",
                    }}
                  >
                    <Sparkles className="h-4 w-4" />
                    Ver resumo
                  </button>
                </Link>
                <Link href="/dashboard">
                  <button className="inline-flex items-center gap-2 rounded-full border border-notura-border/40 bg-notura-surface px-5 py-2.5 text-sm font-medium text-notura-ink-secondary transition-colors hover:bg-notura-surface-2">
                    Ir para reuniões
                  </button>
                </Link>
              </div>
            </>
          ) : (
            <>
              <div>
                <h2 className="font-manrope font-extrabold text-2xl tracking-[-0.4px] text-notura-ink sm:text-3xl">
                  Processando insights com IA
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-notura-ink-secondary">
                  Isso geralmente leva de 2 a 5 minutos. Pode fechar esta
                  aba — você será notificado quando estiver pronto.
                </p>
              </div>

              <div className="w-full max-w-xs">
                <div className="mb-2 flex items-center justify-between text-xs text-notura-ink-secondary">
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
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-notura-surface-2">
                  <div
                    className="h-1.5 rounded-full transition-all duration-700 ease-out"
                    style={{
                      width: `${progress}%`,
                      background: "linear-gradient(90deg, #6851FF, #8B7AFF)",
                    }}
                  />
                </div>
              </div>

              <AnimatedWaveform active={true} />
            </>
          )}
        </div>
      </div>

      {/* ── Step list ──────────────────────────────────────────────────────── */}
      <div className="space-y-3">
        <h3 className="font-manrope font-extrabold tracking-[-0.2px] text-notura-ink">
          Etapas do processamento
        </h3>
        <div className="space-y-2.5">
          {STEPS.map((step, i) => {
            const raw: StepStatus =
              i < currentStep ? "done" : i === currentStep ? "active" : "pending";
            const finalStatus: StepStatus = done ? "done" : raw;
            return <StepRow key={step.id} step={step} status={finalStatus} />;
          })}
        </div>
      </div>

      {!done && (
        <p className="text-center text-xs leading-relaxed text-notura-ink-secondary">
          O processamento ocorre em segundo plano. Você receberá o resumo no
          WhatsApp assim que estiver pronto, mesmo que feche esta página.
        </p>
      )}

      <style>{`
        @keyframes dotBounce {
          0%, 80%, 100% { transform: translateY(0); opacity: 0.4; }
          40%            { transform: translateY(-3px); opacity: 1; }
        }
      `}</style>
    </div>
  );
}

export default function ProcessingPage() {
  return (
    <Suspense fallback={<LoadingState />}>
      <ProcessingPageContent />
    </Suspense>
  );
}
