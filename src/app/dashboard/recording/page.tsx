"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Mic, ShieldCheck, Sparkles } from "lucide-react";
import { AiInsightTip, ToastProvider, useToast } from "@/components/upload";
import {
  RecordingOverlay,
  RecordingSetupCard,
  type RecordingOverlayStage,
  type RecordingSetupValues,
} from "@/components/recording";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { LoadingState, PageHeader } from "@/components/ui/app";
import { formatRecordingDuration, getPreferredRecordingMimeType } from "@/lib/meetings/recording-session";
import {
  fetchRecordingDefaults,
  submitRecordedMeeting,
} from "./recording-api";

interface MeetingDraft {
  clientName: string;
  whatsappNumber: string;
}

function RecordingPageInner() {
  const router = useRouter();
  const { show } = useToast();

  const [accountWhatsappNumber, setAccountWhatsappNumber] = useState("");
  const [isLoadingDefaults, setIsLoadingDefaults] = useState(true);
  const [isStarting, setIsStarting] = useState(false);
  const [overlayStage, setOverlayStage] =
    useState<RecordingOverlayStage | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [recordedAt, setRecordedAt] = useState<Date | null>(null);
  const [meetingDraft, setMeetingDraft] = useState<MeetingDraft | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [overlayError, setOverlayError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const cleanupRecorderResources = useCallback(() => {
    clearTimer();
    mediaRecorderRef.current = null;
    mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
    mediaStreamRef.current = null;
  }, [clearTimer]);

  const resetRecordingState = useCallback(() => {
    cleanupRecorderResources();
    recordedChunksRef.current = [];
    setRecordedBlob(null);
    setRecordedAt(null);
    setMeetingDraft(null);
    setElapsedSeconds(0);
    setUploadProgress(0);
    setOverlayError(null);
    setOverlayStage(null);
  }, [cleanupRecorderResources]);

  useEffect(() => {
    let cancelled = false;

    async function loadDefaults() {
      try {
        const defaults = await fetchRecordingDefaults();
        if (!cancelled) {
          setAccountWhatsappNumber(defaults.accountWhatsappNumber);
        }
      } catch (error) {
        if (!cancelled) {
          show(
            error instanceof Error
              ? error.message
              : "Erro ao carregar os dados da gravação.",
            "warning"
          );
        }
      } finally {
        if (!cancelled) {
          setIsLoadingDefaults(false);
        }
      }
    }

    void loadDefaults();

    return () => {
      cancelled = true;
      cleanupRecorderResources();
    };
  }, [cleanupRecorderResources, show]);

  useEffect(() => {
    if (overlayStage !== "recording") {
      clearTimer();
      return;
    }

    timerRef.current = setInterval(() => {
      setElapsedSeconds((current) => current + 1);
    }, 1000);

    return () => clearTimer();
  }, [clearTimer, overlayStage]);

  const handleStartRecording = useCallback(
    async (values: RecordingSetupValues) => {
      if (
        typeof window === "undefined" ||
        typeof navigator === "undefined" ||
        !navigator.mediaDevices?.getUserMedia ||
        typeof MediaRecorder === "undefined"
      ) {
        show("Seu navegador não suporta gravação de áudio nesta página.", "error");
        return;
      }

      setIsStarting(true);
      setOverlayError(null);

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: false,
        });
        const mimeType = getPreferredRecordingMimeType((candidate) =>
          MediaRecorder.isTypeSupported(candidate)
        );
        const recorder = mimeType
          ? new MediaRecorder(stream, { mimeType })
          : new MediaRecorder(stream);

        mediaStreamRef.current = stream;
        mediaRecorderRef.current = recorder;
        recordedChunksRef.current = [];

        recorder.addEventListener("dataavailable", (event) => {
          if (event.data.size > 0) {
            recordedChunksRef.current.push(event.data);
          }
        });

        recorder.start(1000);
        setMeetingDraft(values);
        setElapsedSeconds(0);
        setRecordedBlob(null);
        setRecordedAt(null);
        setUploadProgress(0);
        setOverlayStage("recording");
      } catch {
        show(
          "Permissão de microfone negada. Habilite o acesso e tente novamente.",
          "error"
        );
      } finally {
        setIsStarting(false);
      }
    },
    [show]
  );

  const stopActiveRecording = useCallback(async (): Promise<Blob> => {
    const recorder = mediaRecorderRef.current;

    if (!recorder) {
      throw new Error("Nenhuma gravação ativa encontrada.");
    }

    return await new Promise<Blob>((resolve, reject) => {
      const finalizeBlob = () => {
        const nextBlob = new Blob(recordedChunksRef.current, {
          type: recorder.mimeType || "audio/webm",
        });

        if (nextBlob.size <= 0) {
          reject(new Error("Nenhum áudio foi capturado nesta gravação."));
          return;
        }

        resolve(nextBlob);
      };

      recorder.addEventListener(
        "stop",
        () => {
          finalizeBlob();
        },
        { once: true }
      );

      recorder.addEventListener(
        "error",
        () => {
          reject(new Error("Falha ao encerrar a gravação."));
        },
        { once: true }
      );

      if (recorder.state === "inactive") {
        finalizeBlob();
        return;
      }

      try {
        recorder.stop();
      } catch (error) {
        reject(
          error instanceof Error
            ? error
            : new Error("Falha ao encerrar a gravação.")
        );
      }
    });
  }, []);

  const handleStopRecording = useCallback(async () => {
    clearTimer();

    try {
      const nextBlob = await stopActiveRecording();
      cleanupRecorderResources();
      setRecordedBlob(nextBlob);
      setRecordedAt(new Date());
      setOverlayStage("confirm");
    } catch (error) {
      cleanupRecorderResources();
      show(
        error instanceof Error
          ? error.message
          : "Erro ao encerrar a gravação.",
        "error"
      );
      resetRecordingState();
    }
  }, [
    cleanupRecorderResources,
    clearTimer,
    resetRecordingState,
    show,
    stopActiveRecording,
  ]);

  const handleSaveRecording = useCallback(async () => {
    if (!meetingDraft || !recordedBlob) {
      show("Nenhuma gravação pronta para envio.", "error");
      return;
    }

    setOverlayStage("saving");
    setOverlayError(null);
    setUploadProgress(0);

    try {
      const meetingId = await submitRecordedMeeting({
        clientName: meetingDraft.clientName,
        whatsappNumber: meetingDraft.whatsappNumber,
        recording: recordedBlob,
        recordedAt: recordedAt ?? new Date(),
        onUploadProgress: setUploadProgress,
      });

      router.push(`/dashboard/processing?id=${meetingId}`);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Erro ao salvar a gravação. Tente novamente.";
      setOverlayError(message);
      setOverlayStage("confirm");
      show(message, "error");
    }
  }, [meetingDraft, recordedAt, recordedBlob, router, show]);

  if (isLoadingDefaults) {
    return <LoadingState label="Carregando opções da gravação..." />;
  }

  return (
    <>
      <div className="animate-fade-in min-h-full">
        <PageHeader
          breadcrumbs={[
            { label: "Dashboard", href: "/dashboard" },
            { label: "Gravação ao vivo" },
          ]}
          title="Gravar reunião"
          description="Inicie a gravação, confirme ao encerrar e deixe que a IA cuide do resto."
        />

        <div className="mt-8 flex flex-col gap-6 lg:flex-row lg:items-start lg:gap-8">
          <div className="flex min-w-0 flex-1 flex-col gap-4">
            <RecordingSetupCard
              accountWhatsappNumber={accountWhatsappNumber}
              isStarting={isStarting}
              onStart={handleStartRecording}
              onValidationError={(message) => show(message, "warning")}
            />

            <Card className="rounded-2xl border-border/80 bg-card/95 shadow-sm">
              <CardContent className="flex flex-col gap-4 px-5 py-5 sm:px-6">
                <div className="flex items-center gap-2">
                  <Badge variant="processing" className="rounded-full px-3 py-1 text-xs">
                    Fluxo simples
                  </Badge>
                  <Badge variant="default" className="rounded-full px-3 py-1 text-xs">
                    Mobile-first
                  </Badge>
                </div>

                <div className="grid gap-3 sm:grid-cols-3">
                  {[
                    {
                      icon: Mic,
                      title: "Grave direto no navegador",
                      body: "Sem participantes nem campos extras: só cliente, WhatsApp e iniciar.",
                    },
                    {
                      icon: ShieldCheck,
                      title: "Confirme antes de enviar",
                      body: "Ao encerrar, você escolhe entre descartar a gravação ou gerar o sumário.",
                    },
                    {
                      icon: Sparkles,
                      title: "Siga para o processing",
                      body: "Depois do upload, a reunião entra no mesmo pipeline da tela de envio.",
                    },
                  ].map((item) => (
                    <div
                      key={item.title}
                      className="rounded-2xl border border-border/70 bg-background px-4 py-4"
                    >
                      <item.icon className="h-4 w-4 text-primary" />
                      <p className="mt-3 text-sm font-semibold text-foreground">
                        {item.title}
                      </p>
                      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                        {item.body}
                      </p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="w-full shrink-0 lg:w-[340px]">
            <AiInsightTip />
          </div>
        </div>
      </div>

      {overlayStage ? (
        <RecordingOverlay
          stage={overlayStage}
          elapsedLabel={formatRecordingDuration(elapsedSeconds)}
          uploadProgress={uploadProgress}
          errorMessage={overlayError}
          onStop={handleStopRecording}
          onDiscard={resetRecordingState}
          onSave={handleSaveRecording}
        />
      ) : null}
    </>
  );
}

export default function RecordingPage() {
  return (
    <ToastProvider>
      <RecordingPageInner />
    </ToastProvider>
  );
}
