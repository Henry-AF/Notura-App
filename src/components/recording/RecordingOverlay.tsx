"use client";

import { Loader2, Sparkles, Square, TimerReset, Trash2 } from "lucide-react";
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
  errorMessage?: string | null;
  onStop: () => void;
  onDiscard: () => void;
  onSave: () => void;
}

export function RecordingOverlay({
  stage,
  elapsedLabel,
  uploadProgress,
  errorMessage,
  onStop,
  onDiscard,
  onSave,
}: RecordingOverlayProps) {
  const isRecording = stage === "recording";
  const isSaving = stage === "saving";

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-background/80 backdrop-blur-sm sm:items-center sm:p-6">
      <Card className="h-full w-full rounded-none border-0 bg-card sm:h-auto sm:max-w-xl sm:rounded-3xl sm:border sm:border-border/80">
        <CardContent className="flex h-full flex-col justify-center px-6 py-10 sm:px-8">
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
              {isRecording ? "Gravando agora" : isSaving ? "Enviando gravação" : "Gravação finalizada"}
            </Badge>

            <div>
              <h2 className="font-display text-2xl font-bold text-card-foreground sm:text-3xl">
                {isRecording
                  ? "Gravação em andamento"
                  : isSaving
                    ? "Gerando o sumário"
                    : "O que deseja fazer com a gravação?"}
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {isRecording
                  ? "Quando encerrar, você poderá escolher entre descartar o áudio ou enviar para processamento."
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

            <RecordingWaveform active={isRecording || isSaving} className="w-full" />

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
              <p className="w-full rounded-2xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
                {errorMessage}
              </p>
            ) : null}

            {isRecording ? (
              <Button
                onClick={onStop}
                className="h-12 w-full rounded-full bg-primary text-primary-foreground hover:bg-primary/90 sm:max-w-xs"
              >
                <Square className="h-4 w-4" />
                Encerrar gravação
              </Button>
            ) : isSaving ? (
              <Button
                disabled
                className="h-12 w-full rounded-full bg-primary text-primary-foreground opacity-100 sm:max-w-xs"
              >
                <Loader2 className="h-4 w-4 animate-spin" />
                Enviando arquivo...
              </Button>
            ) : (
              <div className="grid w-full gap-3 sm:grid-cols-2">
                <Button
                  variant="outline"
                  onClick={onDiscard}
                  className="h-12 rounded-full"
                >
                  <Trash2 className="h-4 w-4" />
                  Descartar gravação
                </Button>
                <Button
                  onClick={onSave}
                  className="h-12 rounded-full bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  <Sparkles className="h-4 w-4" />
                  Gerar sumário
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
