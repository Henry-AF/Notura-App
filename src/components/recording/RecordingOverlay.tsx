"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import {
  Loader2,
  Minimize2,
  Pause,
  Play,
  Sparkles,
  Square,
  TimerReset,
  Trash2,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { RecordingWaveform } from "./RecordingWaveform";

export type RecordingOverlayStage = "recording" | "confirm" | "saving";

interface RecordingOverlayProps {
  stage: RecordingOverlayStage;
  elapsedLabel: string;
  uploadProgress: number;
  isPaused?: boolean;
  errorMessage?: string | null;
  onStop: () => void;
  onPauseToggle?: () => void;
  onResumeRecording?: () => void;
  onDiscard: () => void;
  onSave: () => void;
  onClose?: () => void;
  onMinimize?: () => void;
}

interface RecordingActionButtonProps {
  children: ReactNode;
  icon: ReactNode;
  onClick?: () => void;
  variant?: "primary" | "outline";
  disabled?: boolean;
}

function RecordingActionButton({
  children,
  icon,
  onClick,
  variant = "primary",
  disabled = false,
}: RecordingActionButtonProps) {
  return (
    <Button
      variant={variant === "outline" ? "outline" : "default"}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "h-12 rounded-full",
        variant === "primary" &&
          "bg-primary text-primary-foreground hover:bg-primary/90",
        disabled && "opacity-100"
      )}
    >
      {icon}
      {children}
    </Button>
  );
}

export function RecordingOverlay({
  stage,
  elapsedLabel,
  uploadProgress,
  isPaused = false,
  errorMessage,
  onStop,
  onPauseToggle,
  onResumeRecording,
  onDiscard,
  onSave,
  onClose,
  onMinimize,
}: RecordingOverlayProps) {
  const isRecording = stage === "recording";
  const isSaving = stage === "saving";
  const hasError = !!errorMessage;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-background/80 backdrop-blur-sm sm:items-center sm:p-6">
      <Card className="h-full w-full rounded-none border-0 bg-card sm:h-auto sm:max-w-xl sm:rounded-3xl sm:border sm:border-border/80">
        <CardContent className="flex h-full flex-col justify-center px-6 py-10 sm:px-8">
          {(onMinimize || (hasError && onClose)) ? (
            <div className="mb-4 flex justify-end gap-2 sm:-mt-4">
              {onMinimize ? (
                <button
                  type="button"
                  aria-label="Minimizar gravação"
                  onClick={onMinimize}
                  className="rounded-full p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  <Minimize2 className="h-5 w-5" />
                </button>
              ) : null}
              {hasError && onClose ? (
                <button
                  type="button"
                  aria-label="Fechar"
                  onClick={onClose}
                  className="rounded-full p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  <X className="h-5 w-5" />
                </button>
              ) : null}
            </div>
          ) : null}

          <div className="mx-auto flex w-full max-w-md flex-col items-center gap-6 text-center">
            <Badge
              variant={isSaving ? "processing" : "recording"}
              className={cn(
                "rounded-full px-4 py-1.5 text-sm",
                isSaving
                  ? "bg-notura-primary/15 text-notura-primary"
                  : "bg-notura-primary text-primary-foreground"
              )}
            >
              {isRecording
                ? isPaused
                  ? "Gravação pausada"
                  : "Gravando agora"
                : isSaving
                  ? "Enviando gravação"
                  : "Gravação finalizada"}
            </Badge>

            <div>
              <h2 className="font-display text-2xl font-bold text-card-foreground sm:text-3xl">
                {isRecording
                  ? isPaused
                    ? "Gravação pausada"
                    : "Gravação em andamento"
                  : isSaving
                    ? "Gerando o sumário"
                    : "O que deseja fazer com a gravação?"}
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {isRecording
                  ? isPaused
                    ? "A captura está pausada. Continue quando quiser ou encerre para revisar o áudio."
                    : "Quando encerrar, você poderá escolher entre descartar o áudio ou enviar para processamento."
                  : isSaving
                    ? "Estamos subindo o arquivo e iniciando o processamento em segundo plano."
                    : "Se você salvar agora, o arquivo será enviado e a reunião seguirá para a tela de processamento."}
              </p>
            </div>

            <div className="flex items-center gap-3 rounded-full border border-border/70 bg-background px-5 py-2.5">
              <TimerReset className="h-4 w-4 text-primary" />
              <span className="font-mono text-lg font-semibold tabular-nums text-foreground">
                {elapsedLabel}
              </span>
            </div>

            <RecordingWaveform active={(isRecording && !isPaused) || isSaving} className="w-full" />

            {isSaving ? (
              <div className="w-full max-w-sm">
                <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
                  <span>Upload do arquivo</span>
                  <span>{uploadProgress}%</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-2 rounded-full transition-all duration-300 ease-out"
                    style={{
                      width: `${uploadProgress}%`,
                      background: "linear-gradient(90deg, #6851FF, #8B7AFF)",
                    }}
                  />
                </div>
              </div>
            ) : null}

            {errorMessage ? (
              <div className="w-full rounded-2xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-left text-sm text-destructive">
                <p>{errorMessage}</p>
                <Link
                  href="/dashboard/meetings"
                  className="mt-1.5 inline-block font-medium underline underline-offset-2 hover:opacity-80"
                >
                  Ir para a tela de reuniões →
                </Link>
              </div>
            ) : null}

            {isRecording ? (
              <div className="grid w-full gap-3 sm:grid-cols-2">
                <RecordingActionButton
                  variant="outline"
                  onClick={onPauseToggle}
                  icon={
                    isPaused ? (
                      <Play className="h-4 w-4" />
                    ) : (
                      <Pause className="h-4 w-4" />
                    )
                  }
                >
                  {isPaused ? "Continuar gravação" : "Pausar gravação"}
                </RecordingActionButton>
                <RecordingActionButton
                  onClick={onStop}
                  icon={<Square className="h-4 w-4" />}
                >
                  Encerrar gravação
                </RecordingActionButton>
              </div>
            ) : isSaving ? (
              <RecordingActionButton
                disabled
                icon={<Loader2 className="h-4 w-4 animate-spin" />}
              >
                Enviando arquivo...
              </RecordingActionButton>
            ) : (
              <div className="grid w-full gap-3 sm:grid-cols-3">
                <RecordingActionButton
                  variant="outline"
                  onClick={onDiscard}
                  icon={<Trash2 className="h-4 w-4" />}
                >
                  Descartar gravação
                </RecordingActionButton>
                <RecordingActionButton
                  variant="outline"
                  onClick={onResumeRecording}
                  icon={<Play className="h-4 w-4" />}
                >
                  Retomar gravação
                </RecordingActionButton>
                <RecordingActionButton
                  onClick={onSave}
                  icon={<Sparkles className="h-4 w-4" />}
                >
                  Gerar sumário
                </RecordingActionButton>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
