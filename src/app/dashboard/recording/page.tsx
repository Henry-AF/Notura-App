"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Mic, ShieldCheck, Sparkles } from "lucide-react";
import { AiInsightTip, ToastProvider, useToast } from "@/components/upload";
import {
  RecordingOverlay,
  RecordingSetupCard,
  type RecordingMode,
  type RecordingOverlayStage,
  type RecordingSetupValues,
} from "@/components/recording";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { LoadingState, PageHeader } from "@/components/ui/app";
import {
  RemoteDisplayAudioMissingError,
  createMicrophoneRecordingCapture,
  createRemoteMeetingRecordingCapture,
  formatRecordingDuration,
  getPreferredRecordingMimeType,
  type MeetingRecordingCapture,
} from "@/lib/meetings/recording-session";
import {
  fetchRecordingDefaults,
  submitRecordedMeeting,
} from "./recording-api";

interface MeetingDraft {
  clientName: string;
  whatsappNumber: string;
}

function createRecordingMediaRecorder(stream: MediaStream): MediaRecorder {
  const mimeType = getPreferredRecordingMimeType((candidate) =>
    MediaRecorder.isTypeSupported(candidate)
  );

  return mimeType
    ? new MediaRecorder(stream, { mimeType })
    : new MediaRecorder(stream);
}

async function createRecordingCapture(
  mode: RecordingMode
): Promise<MeetingRecordingCapture> {
  if (mode === "remote") {
    return await createRemoteMeetingRecordingCapture();
  }

  return await createMicrophoneRecordingCapture();
}

function getStartRecordingErrorMessage(
  error: unknown,
  mode: RecordingMode
): string {
  if (error instanceof RemoteDisplayAudioMissingError) {
    return "Selecione uma aba, janela ou tela com áudio compartilhado para gravar reunião remota.";
  }

  if (mode === "remote") {
    return error instanceof Error
      ? error.message
      : "Não foi possível iniciar a gravação remota.";
  }

  return "Permissão de microfone negada. Habilite o acesso e tente novamente.";
}

function GrainOverlay() {
  return (
    <svg
      className="pointer-events-none absolute inset-0 h-full w-full"
      aria-hidden="true"
      preserveAspectRatio="none"
    >
      <filter id="rp-grain-filter">
        <feTurbulence type="fractalNoise" baseFrequency="0.65" numOctaves="3" stitchTiles="stitch" />
        <feColorMatrix type="saturate" values="0" />
      </filter>
      <rect width="100%" height="100%" filter="url(#rp-grain-filter)" opacity="0.07" />
    </svg>
  );
}

function RecordingPageHeader({ mode }: { mode: RecordingMode }) {
  const isRemote = mode === "remote";
  const title = isRemote ? "Gravar Reunião Remota" : "Gravar Reunião Presencial";

  return (
    <div className="relative overflow-hidden rounded-2xl px-6 pb-8 pt-6">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-gradient-to-br from-primary/25 via-primary/10 to-transparent transition-opacity duration-500"
        style={{ opacity: isRemote ? 0 : 1 }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-gradient-to-br from-emerald-500/25 via-emerald-500/10 to-transparent transition-opacity duration-500"
        style={{ opacity: isRemote ? 1 : 0 }}
      />
      <GrainOverlay />
      <div className="relative z-10">
        <PageHeader
          breadcrumbs={[
            { label: "Dashboard", href: "/dashboard" },
            { label: "Gravação ao vivo" },
          ]}
          title={
            <span key={mode} className="animate-fade-in inline-block">
              {title}
            </span>
          }
          description="Inicie a gravação, confirme ao encerrar e deixe que a IA cuide do resto."
        />
      </div>
    </div>
  );
}

function RecordingPageInner() {
  const router = useRouter();
  const { show } = useToast();

  const [accountWhatsappNumber, setAccountWhatsappNumber] = useState("");
  const [isLoadingDefaults, setIsLoadingDefaults] = useState(true);
  const [isStarting, setIsStarting] = useState(false);
  const [recordingMode, setRecordingMode] = useState<RecordingMode>("in-person");
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
  const captureCleanupRef = useRef<(() => void) | null>(null);
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
    captureCleanupRef.current?.();
    captureCleanupRef.current = null;
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
        let capture: MeetingRecordingCapture | null = null;

        try {
          capture = await createRecordingCapture(values.recordingMode);
          const recorder = createRecordingMediaRecorder(capture.stream);

          captureCleanupRef.current = capture.cleanup;
          mediaStreamRef.current = capture.stream;
          mediaRecorderRef.current = recorder;
          recordedChunksRef.current = [];

          recorder.addEventListener("dataavailable", (event) => {
            if (event.data.size > 0) {
              recordedChunksRef.current.push(event.data);
            }
          });

          recorder.start(1000);
        } catch (error) {
          capture?.cleanup();
          captureCleanupRef.current = null;
          mediaStreamRef.current = null;
          mediaRecorderRef.current = null;
          throw error;
        }

        setMeetingDraft({
          clientName: values.clientName,
          whatsappNumber: values.whatsappNumber,
        });
        setElapsedSeconds(0);
        setRecordedBlob(null);
        setRecordedAt(null);
        setUploadProgress(0);
        setOverlayStage("recording");
      } catch (error) {
        show(getStartRecordingErrorMessage(error, values.recordingMode), "error");
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
        <RecordingPageHeader mode={recordingMode} />

        <div className="mt-8 flex flex-col gap-6 lg:flex-row lg:items-start lg:gap-8">
          <div className="flex min-w-0 flex-1 flex-col gap-4">
            <RecordingSetupCard
              accountWhatsappNumber={accountWhatsappNumber}
              isStarting={isStarting}
              recordingMode={recordingMode}
              onRecordingModeChange={setRecordingMode}
              onStart={handleStartRecording}
              onValidationError={(message) => show(message, "warning")}
            />
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
