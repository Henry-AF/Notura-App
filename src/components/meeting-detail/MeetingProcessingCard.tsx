"use client";

import React, { useEffect, useState } from "react";
import {
  CheckCircle,
  Clock,
  FileAudio,
  MessageCircle,
  Sparkles,
  Wand2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

// ─── Processing steps (mirrors the backend Inngest step ids) ─────────────────

interface ProcessingStep {
  id: string;
  icon: React.ElementType;
  label: string;
  sublabel: string;
}

const PROCESSING_STEPS: ProcessingStep[] = [
  {
    id: "update-status-processing",
    icon: FileAudio,
    label: "Preparando job",
    sublabel: "Validando arquivo e iniciando o processamento",
  },
  {
    id: "transcribe",
    icon: Wand2,
    label: "Transcrevendo",
    sublabel: "Convertendo fala em texto com AssemblyAI",
  },
  {
    id: "index-transcript-chunks",
    icon: FileAudio,
    label: "Indexando transcrição",
    sublabel: "Preparando trechos para busca e chats da reunião",
  },
  {
    id: "summarize-meeting",
    icon: Sparkles,
    label: "Analisando com IA",
    sublabel: "Identificando decisões, tarefas e resumo",
  },
  {
    id: "save-results",
    icon: CheckCircle,
    label: "Salvando resultados",
    sublabel: "Gravando resumo, tarefas e decisões",
  },
  {
    id: "send-whatsapp",
    icon: MessageCircle,
    label: "Enviando no WhatsApp",
    sublabel: "Entregando resumo para você",
  },
  {
    id: "cleanup",
    icon: CheckCircle,
    label: "Finalizando",
    sublabel: "Concluindo o job e removendo o áudio temporário",
  },
];

function findStepIndex(processingStep: string | null): number {
  if (!processingStep) return 0;
  const index = PROCESSING_STEPS.findIndex((step) => step.id === processingStep);
  return index >= 0 ? index : 0;
}

function formatElapsed(elapsed: number): string {
  const m = Math.floor(elapsed / 60);
  const s = elapsed % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function useElapsedSeconds(isRunning: boolean): number {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!isRunning) return;
    const timer = window.setInterval(
      () => setElapsed((current) => current + 1),
      1000
    );
    return () => window.clearInterval(timer);
  }, [isRunning]);

  return elapsed;
}

// ─── Step row ────────────────────────────────────────────────────────────────

type StepStatus = "pending" | "active" | "done";

function resolveStepStatus(index: number, currentStep: number, isDone: boolean): StepStatus {
  if (isDone || index < currentStep) return "done";
  return index === currentStep ? "active" : "pending";
}

const STEP_ROW_CLASS: Record<StepStatus, string> = {
  active: "border-notura-primary/25 bg-notura-surface shadow-sm",
  done: "border-notura-border/15 bg-notura-surface/40",
  pending: "border-notura-border/15 bg-notura-surface/20 opacity-50",
};

const STEP_ICON_WRAP_CLASS: Record<StepStatus, string> = {
  active: "bg-notura-primary/15",
  done: "bg-notura-success/15",
  pending: "bg-notura-surface",
};

const STEP_LABEL_CLASS: Record<StepStatus, string> = {
  active: "text-notura-ink",
  done: "text-notura-success",
  pending: "text-notura-ink-secondary",
};

function ProcessingStepRow({ step, status }: { step: ProcessingStep; status: StepStatus }) {
  const Icon = step.icon;
  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-xl border px-3 py-2.5 transition-all duration-300",
        STEP_ROW_CLASS[status]
      )}
    >
      <div
        className={cn(
          "flex size-8 shrink-0 items-center justify-center rounded-lg transition-all duration-300",
          STEP_ICON_WRAP_CLASS[status]
        )}
      >
        {status === "done" ? (
          <CheckCircle className="size-4 text-notura-success" />
        ) : (
          <Icon
            className={cn(
              "size-4",
              status === "active" ? "text-notura-primary" : "text-notura-ink-secondary"
            )}
          />
        )}
      </div>

      <div className="min-w-0 flex-1">
        <p
          className={cn(
            "text-sm font-semibold transition-colors duration-200",
            STEP_LABEL_CLASS[status]
          )}
        >
          {step.label}
        </p>
        <p className="mt-0.5 truncate text-xs text-notura-ink-secondary/70">
          {step.sublabel}
        </p>
      </div>

      {status === "active" && (
        <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-notura-primary/15 px-2.5 py-1 text-[11px] font-medium text-notura-primary">
          <span className="relative flex size-1.5">
            <span className="absolute size-full animate-ping rounded-full bg-notura-primary opacity-60" />
            <span className="size-1.5 rounded-full bg-notura-primary" />
          </span>
          Em curso
        </span>
      )}
    </div>
  );
}

// ─── Progress header ─────────────────────────────────────────────────────────

function ProcessingHero({
  clientName,
  isDone,
  stepLabel,
  elapsedLabel,
  progress,
}: {
  clientName: string;
  isDone: boolean;
  stepLabel: string;
  elapsedLabel: string;
  progress: number;
}) {
  return (
    <div className="flex flex-col items-center gap-4 text-center">
      <div
        className={cn(
          "flex size-14 items-center justify-center rounded-full transition-all duration-500",
          isDone ? "bg-notura-success/15" : "bg-notura-primary/15"
        )}
      >
        {isDone ? (
          <CheckCircle className="size-7 text-notura-success" />
        ) : (
          <Sparkles
            className="size-7 text-notura-primary"
            style={{ animation: "processingPulse 1.6s ease-in-out infinite" }}
          />
        )}
      </div>

      <div>
        <h2 className="font-manrope text-xl font-extrabold tracking-[-0.3px] text-notura-ink">
          {isDone ? "Pronto! 🎉" : `Processando reunião com ${clientName}`}
        </h2>
        <p className="mt-1.5 text-sm leading-relaxed text-notura-ink-secondary">
          {isDone
            ? "Resumo gerado com sucesso. Preparando a visualização..."
            : "Isso geralmente leva de 2 a 5 minutos. Você pode acompanhar as etapas abaixo."}
        </p>
      </div>

      <div className="w-full max-w-xs">
        <div className="mb-2 flex items-center justify-between text-xs text-notura-ink-secondary">
          <span>{isDone ? "Concluído" : stepLabel}</span>
          <span className="flex items-center gap-1">
            <Clock className="size-3" />
            {elapsedLabel}
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
    </div>
  );
}

// ─── Card ────────────────────────────────────────────────────────────────────

export interface MeetingProcessingCardProps {
  clientName: string;
  processingStep: string | null;
  isDone: boolean;
  isCancelingProcessing: boolean;
  onCancelProcessing: () => void;
}

export function MeetingProcessingCard({
  clientName,
  processingStep,
  isDone,
  isCancelingProcessing,
  onCancelProcessing,
}: MeetingProcessingCardProps) {
  const currentStep = findStepIndex(processingStep);
  const elapsed = useElapsedSeconds(!isDone);
  const progress = isDone
    ? 100
    : Math.min(Math.round(((currentStep + 1) / PROCESSING_STEPS.length) * 100), 99);

  return (
    <div
      className={cn(
        "relative mt-4 overflow-hidden rounded-2xl border px-6 py-8 transition-all duration-700 sm:px-8",
        isDone
          ? "border-notura-success/30 bg-notura-success/5"
          : "border-notura-primary/20 bg-notura-surface"
      )}
    >
      <div
        className="pointer-events-none absolute -top-16 left-1/2 size-64 -translate-x-1/2 rounded-full blur-3xl transition-colors duration-700"
        style={{
          background: isDone ? "rgba(34,197,94,0.07)" : "rgba(104,81,255,0.08)",
        }}
      />

      <div className="relative z-10 flex flex-col gap-6">
        <ProcessingHero
          clientName={clientName}
          isDone={isDone}
          stepLabel={PROCESSING_STEPS[currentStep].label}
          elapsedLabel={formatElapsed(elapsed)}
          progress={progress}
        />

        <div className="mx-auto w-full max-w-xl space-y-2">
          {PROCESSING_STEPS.map((step, index) => (
            <ProcessingStepRow
              key={step.id}
              step={step}
              status={resolveStepStatus(index, currentStep, isDone)}
            />
          ))}
        </div>

        {!isDone && (
          <div className="flex justify-center">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onCancelProcessing}
              disabled={isCancelingProcessing}
              className="border-destructive/40 text-destructive hover:bg-destructive/10"
            >
              {isCancelingProcessing ? "Cancelando..." : "Cancelar processamento"}
            </Button>
          </div>
        )}
      </div>

      <style>{`
        @keyframes processingPulse {
          0%, 100% { transform: scale(1); opacity: 1; }
          50%      { transform: scale(1.12); opacity: 0.75; }
        }
      `}</style>
    </div>
  );
}
