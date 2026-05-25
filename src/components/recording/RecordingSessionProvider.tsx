"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import { Loader2, Maximize2, Square } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  RemoteDisplayAudioMissingError,
  createMicrophoneRecordingCapture,
  createRemoteMeetingRecordingCapture,
  formatRecordingDuration,
  getPreferredRecordingMimeType,
  type MeetingRecordingCapture,
} from "@/lib/meetings/recording-session";
import { submitRecordedMeeting } from "@/app/dashboard/recording/recording-api";
import { RecordingOverlay, type RecordingOverlayStage } from "./RecordingOverlay";
import type { RecordingMode, RecordingSetupValues } from "./RecordingSetupCard";

interface MeetingDraft {
  whatsappNumber: string;
  groupId: string | null;
}

interface RecordingSessionContextValue {
  hasActiveSession: boolean;
  isStarting: boolean;
  startRecording: (values: RecordingSetupValues) => Promise<void>;
}

interface MinimizedRecordingControllerProps {
  stage: RecordingOverlayStage;
  elapsedLabel: string;
  uploadProgress: number;
  onExpand: () => void;
  onStop: () => void;
}

const RecordingSessionContext =
  createContext<RecordingSessionContextValue | null>(null);

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

function MinimizedRecordingController({
  stage,
  elapsedLabel,
  uploadProgress,
  onExpand,
  onStop,
}: MinimizedRecordingControllerProps) {
  const isRecording = stage === "recording";
  const isSaving = stage === "saving";

  return (
    <div className="fixed bottom-4 left-1/2 z-50 flex w-[min(calc(100%-24px),420px)] -translate-x-1/2 items-center gap-2 rounded-2xl border border-border/80 bg-card/95 p-2 shadow-2xl backdrop-blur sm:left-auto sm:right-5 sm:w-auto sm:translate-x-0">
      <button
        type="button"
        onClick={onExpand}
        className="flex min-w-0 flex-1 items-center gap-3 rounded-xl px-3 py-2 text-left transition-colors hover:bg-muted"
      >
        <span
          className={cn(
            "flex h-9 w-9 shrink-0 items-center justify-center rounded-full",
            isSaving
              ? "bg-notura-primary/15 text-notura-primary"
              : "bg-red-500/15 text-red-500"
          )}
        >
          {isSaving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <span className="h-2.5 w-2.5 rounded-full bg-current" />
          )}
        </span>
        <span className="min-w-0">
          <span className="block truncate text-sm font-semibold text-card-foreground">
            {isRecording
              ? "Gravando"
              : isSaving
                ? `Enviando ${uploadProgress}%`
                : "Gravação pronta"}
          </span>
          <span className="block font-mono text-xs tabular-nums text-muted-foreground">
            {elapsedLabel}
          </span>
        </span>
        <Maximize2 className="h-4 w-4 shrink-0 text-muted-foreground" />
      </button>

      {isRecording ? (
        <button
          type="button"
          onClick={onStop}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground transition-colors hover:bg-primary/90"
          aria-label="Encerrar gravação"
        >
          <Square className="h-4 w-4" />
        </button>
      ) : null}
    </div>
  );
}

export function RecordingSessionProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();

  const [isStarting, setIsStarting] = useState(false);
  const [overlayStage, setOverlayStage] =
    useState<RecordingOverlayStage | null>(null);
  const [isMinimized, setIsMinimized] = useState(false);
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
    setIsMinimized(false);
  }, [cleanupRecorderResources]);

  useEffect(() => {
    return () => cleanupRecorderResources();
  }, [cleanupRecorderResources]);

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

  const startRecording = useCallback(
    async (values: RecordingSetupValues) => {
      if (overlayStage || isStarting) {
        throw new Error(
          "Finalize ou descarte a gravação atual antes de iniciar outra."
        );
      }

      if (
        typeof window === "undefined" ||
        typeof navigator === "undefined" ||
        !navigator.mediaDevices?.getUserMedia ||
        typeof MediaRecorder === "undefined"
      ) {
        throw new Error("Seu navegador não suporta gravação de áudio nesta página.");
      }

      setIsStarting(true);
      setOverlayError(null);
      setIsMinimized(false);

      try {
        let capture: MeetingRecordingCapture | null = null;

        try {
          capture = await createRecordingCapture(
            values.recordingMode === "remote" ? "remote" : "in-person"
          );
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
          whatsappNumber: values.whatsappNumber,
          groupId: values.groupId ?? null,
        });
        setElapsedSeconds(0);
        setRecordedBlob(null);
        setRecordedAt(null);
        setUploadProgress(0);
        setOverlayStage("recording");
      } catch (error) {
        throw new Error(getStartRecordingErrorMessage(error, values.recordingMode));
      } finally {
        setIsStarting(false);
      }
    },
    [isStarting, overlayStage]
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

      recorder.addEventListener("stop", finalizeBlob, { once: true });
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
    setIsMinimized(false);

    try {
      const nextBlob = await stopActiveRecording();
      cleanupRecorderResources();
      setRecordedBlob(nextBlob);
      setRecordedAt(new Date());
      setOverlayStage("confirm");
    } catch (error) {
      cleanupRecorderResources();
      setOverlayError(
        error instanceof Error ? error.message : "Erro ao encerrar a gravação."
      );
      resetRecordingState();
    }
  }, [
    cleanupRecorderResources,
    clearTimer,
    resetRecordingState,
    stopActiveRecording,
  ]);

  const handleSaveRecording = useCallback(async () => {
    if (!meetingDraft || !recordedBlob) {
      setOverlayError("Nenhuma gravação pronta para envio.");
      return;
    }

    setOverlayStage("saving");
    setIsMinimized(false);
    setOverlayError(null);
    setUploadProgress(0);

    try {
      const meetingId = await submitRecordedMeeting({
        whatsappNumber: meetingDraft.whatsappNumber,
        groupId: meetingDraft.groupId,
        recording: recordedBlob,
        recordedAt: recordedAt ?? new Date(),
        onUploadProgress: setUploadProgress,
      });

      resetRecordingState();
      router.push(`/dashboard/processing?id=${meetingId}`);
    } catch (error) {
      console.error("[recording] failed to save recording", error);
      setOverlayError(
        "Sua gravação foi salva. Houve um erro no processamento, mas você pode tentar novamente na tela de reuniões."
      );
      setOverlayStage("confirm");
      setIsMinimized(false);
    }
  }, [meetingDraft, recordedAt, recordedBlob, resetRecordingState, router]);

  const contextValue = useMemo<RecordingSessionContextValue>(
    () => ({
      hasActiveSession: Boolean(overlayStage),
      isStarting,
      startRecording,
    }),
    [isStarting, overlayStage, startRecording]
  );

  const elapsedLabel = formatRecordingDuration(elapsedSeconds);

  return (
    <RecordingSessionContext.Provider value={contextValue}>
      {children}

      {overlayStage && !isMinimized ? (
        <RecordingOverlay
          stage={overlayStage}
          elapsedLabel={elapsedLabel}
          uploadProgress={uploadProgress}
          errorMessage={overlayError}
          onStop={handleStopRecording}
          onDiscard={resetRecordingState}
          onSave={handleSaveRecording}
          onClose={overlayError ? resetRecordingState : undefined}
          onMinimize={() => setIsMinimized(true)}
        />
      ) : null}

      {overlayStage && isMinimized ? (
        <MinimizedRecordingController
          stage={overlayStage}
          elapsedLabel={elapsedLabel}
          uploadProgress={uploadProgress}
          onExpand={() => setIsMinimized(false)}
          onStop={handleStopRecording}
        />
      ) : null}
    </RecordingSessionContext.Provider>
  );
}

export function useRecordingSession(): RecordingSessionContextValue {
  const context = useContext(RecordingSessionContext);

  if (!context) {
    throw new Error(
      "useRecordingSession must be used inside RecordingSessionProvider."
    );
  }

  return context;
}
