"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
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
import {
  acquireRecordingWakeLock,
  type RecordingWakeLock,
} from "@/lib/meetings/recording-wake-lock";
import { submitRecordedMeeting } from "@/app/dashboard/recording/recording-api";
import { RecordingOverlay, type RecordingOverlayStage } from "./RecordingOverlay";
import type { RecordingMode, RecordingSetupValues } from "./RecordingSetupCard";

interface MeetingDraft {
  whatsappNumber: string;
  groupId: string | null;
  recordingMode: RecordingMode;
}

interface RecordingSessionContextValue {
  hasActiveSession: boolean;
  isStarting: boolean;
  startRecording: (values: RecordingSetupValues) => Promise<void>;
}

type RecordingSessionState = {
  isStarting: boolean;
  overlayStage: RecordingOverlayStage | null;
  isMinimized: boolean;
  isPaused: boolean;
  elapsedSeconds: number;
  recordedBlob: Blob | null;
  recordedAt: Date | null;
  meetingDraft: MeetingDraft | null;
  uploadProgress: number;
  overlayError: string | null;
};

type RecordingSessionAction =
  | { type: "patched"; value: Partial<RecordingSessionState> }
  | { type: "elapsedTicked" }
  | { type: "reset" };

const initialRecordingSessionState: RecordingSessionState = {
  isStarting: false,
  overlayStage: null,
  isMinimized: false,
  isPaused: false,
  elapsedSeconds: 0,
  recordedBlob: null,
  recordedAt: null,
  meetingDraft: null,
  uploadProgress: 0,
  overlayError: null,
};

function recordingSessionReducer(
  state: RecordingSessionState,
  action: RecordingSessionAction
): RecordingSessionState {
  switch (action.type) {
    case "patched":
      return { ...state, ...action.value };
    case "elapsedTicked":
      return { ...state, elapsedSeconds: state.elapsedSeconds + 1 };
    case "reset":
      return initialRecordingSessionState;
  }
}

interface MinimizedRecordingControllerProps {
  stage: RecordingOverlayStage;
  elapsedLabel: string;
  uploadProgress: number;
  isPaused: boolean;
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
  isPaused,
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
            "flex size-9 shrink-0 items-center justify-center rounded-full",
            isSaving
              ? "bg-notura-primary/15 text-notura-primary"
              : "bg-red-500/15 text-red-500"
          )}
        >
          {isSaving ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <span className="size-2.5 rounded-full bg-current" />
          )}
        </span>
        <span className="min-w-0">
          <span className="block truncate text-sm font-semibold text-card-foreground">
            {isRecording
              ? isPaused
                ? "Pausado"
                : "Gravando"
              : isSaving
                ? `Enviando ${uploadProgress}%`
                : "Gravação pronta"}
          </span>
          <span className="block font-mono text-xs tabular-nums text-muted-foreground">
            {elapsedLabel}
          </span>
        </span>
        <Maximize2 className="size-4 shrink-0 text-muted-foreground" />
      </button>

      {isRecording ? (
        <button
          type="button"
          onClick={onStop}
          className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground transition-colors hover:bg-primary/90"
          aria-label="Encerrar gravação"
        >
          <Square className="size-4" />
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

  const [state, dispatch] = useReducer(
    recordingSessionReducer,
    initialRecordingSessionState
  );
  const {
    isStarting,
    overlayStage,
    isMinimized,
    isPaused,
    elapsedSeconds,
    recordedBlob,
    recordedAt,
    meetingDraft,
    uploadProgress,
    overlayError,
  } = state;

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const captureCleanupRef = useRef<(() => void) | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const wakeLockRef = useRef<RecordingWakeLock | null>(null);
  const timerRef = useRef<number | null>(null);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      window.clearInterval(timerRef.current);
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

  const releaseWakeLock = useCallback(() => {
    const wakeLock = wakeLockRef.current;
    wakeLockRef.current = null;
    void wakeLock?.release();
  }, []);

  const resetRecordingState = useCallback(() => {
    cleanupRecorderResources();
    recordedChunksRef.current = [];
    dispatch({ type: "reset" });
  }, [cleanupRecorderResources]);

  useEffect(() => {
    return () => cleanupRecorderResources();
  }, [cleanupRecorderResources]);

  useEffect(() => {
    if (overlayStage !== "recording" || isPaused) {
      releaseWakeLock();
      return;
    }

    let isCancelled = false;

    void acquireRecordingWakeLock().then((wakeLock) => {
      if (isCancelled) {
        void wakeLock.release();
        return;
      }

      wakeLockRef.current = wakeLock;
    });

    return () => {
      isCancelled = true;
      releaseWakeLock();
    };
  }, [isPaused, overlayStage, releaseWakeLock]);

  useEffect(() => {
    if (overlayStage !== "recording" || isPaused) {
      clearTimer();
      return;
    }

    timerRef.current = window.setInterval(() => {
      dispatch({ type: "elapsedTicked" });
    }, 1000);

    return () => clearTimer();
  }, [clearTimer, isPaused, overlayStage]);

  const startRecorderSession = useCallback(
    async (values: RecordingSetupValues) => {
      if (
        typeof window === "undefined" ||
        typeof navigator === "undefined" ||
        !navigator.mediaDevices?.getUserMedia ||
        typeof MediaRecorder === "undefined"
      ) {
        throw new Error("Seu navegador não suporta gravação de áudio nesta página.");
      }

      dispatch({
        type: "patched",
        value: { isStarting: true, overlayError: null, isMinimized: false },
      });

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

        dispatch({
          type: "patched",
          value: {
            meetingDraft: {
              whatsappNumber: values.whatsappNumber,
              groupId: values.groupId ?? null,
              recordingMode: values.recordingMode,
            },
            elapsedSeconds: 0,
            recordedBlob: null,
            recordedAt: null,
            uploadProgress: 0,
            isPaused: false,
            overlayStage: "recording",
          },
        });
      } catch (error) {
        throw new Error(getStartRecordingErrorMessage(error, values.recordingMode));
      } finally {
        dispatch({ type: "patched", value: { isStarting: false } });
      }
    },
    []
  );

  const startRecording = useCallback(
    async (values: RecordingSetupValues) => {
      if (overlayStage || isStarting) {
        throw new Error(
          "Finalize ou descarte a gravação atual antes de iniciar outra."
        );
      }

      await startRecorderSession(values);
    },
    [isStarting, overlayStage, startRecorderSession]
  );

  const pauseRecording = useCallback(() => {
    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state !== "recording") {
      return;
    }

    recorder.pause();
    dispatch({ type: "patched", value: { isPaused: true } });
  }, []);

  const resumePausedRecording = useCallback(() => {
    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state !== "paused") {
      return;
    }

    recorder.resume();
    dispatch({ type: "patched", value: { isPaused: false } });
  }, []);

  const handlePauseToggle = useCallback(() => {
    if (isPaused) {
      resumePausedRecording();
      return;
    }

    pauseRecording();
  }, [isPaused, pauseRecording, resumePausedRecording]);

  const buildRecordedBlob = useCallback((recorder: MediaRecorder): Blob => {
    return new Blob(recordedChunksRef.current, {
      type: recorder.mimeType || "audio/webm",
    });
  }, []);

  const requestRecorderData = useCallback(
    async (recorder: MediaRecorder): Promise<void> => {
      if (recorder.state === "inactive") {
        return;
      }

      await new Promise<void>((resolve, reject) => {
        recorder.addEventListener("dataavailable", () => resolve(), {
          once: true,
        });
        recorder.addEventListener(
          "error",
          () => reject(new Error("Falha ao preparar a gravação.")),
          { once: true }
        );
        recorder.requestData();
      });
    },
    []
  );

  const snapshotActiveRecording = useCallback(async (): Promise<Blob> => {
    const recorder = mediaRecorderRef.current;

    if (!recorder || recorder.state === "inactive") {
      throw new Error("Nenhuma gravação ativa encontrada.");
    }

    if (recorder.state === "recording") {
      recorder.pause();
    }

    await requestRecorderData(recorder);
    const nextBlob = buildRecordedBlob(recorder);

    if (nextBlob.size <= 0) {
      throw new Error("Nenhum áudio foi capturado nesta gravação.");
    }

    return nextBlob;
  }, [buildRecordedBlob, requestRecorderData]);

  const stopActiveRecording = useCallback(async (): Promise<Blob> => {
    const recorder = mediaRecorderRef.current;

    if (!recorder) {
      throw new Error("Nenhuma gravação ativa encontrada.");
    }

    return await new Promise<Blob>((resolve, reject) => {
      const finalizeBlob = () => {
        const nextBlob = buildRecordedBlob(recorder);

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
  }, [buildRecordedBlob]);

  const handleStopRecording = useCallback(async () => {
    clearTimer();
    dispatch({
      type: "patched",
      value: { isMinimized: false, isPaused: false },
    });

    try {
      const nextBlob = await snapshotActiveRecording();
      dispatch({
        type: "patched",
        value: {
          recordedBlob: nextBlob,
          recordedAt: new Date(),
          isPaused: true,
          overlayStage: "confirm",
        },
      });
    } catch (error) {
      cleanupRecorderResources();
      dispatch({
        type: "patched",
        value: {
          overlayError:
            error instanceof Error ? error.message : "Erro ao encerrar a gravação.",
        },
      });
      resetRecordingState();
    }
  }, [
    cleanupRecorderResources,
    clearTimer,
    resetRecordingState,
    snapshotActiveRecording,
  ]);

  const resumeStoppedRecording = useCallback(async () => {
    if (!meetingDraft || overlayStage !== "confirm" || isStarting) {
      return;
    }

    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state !== "paused") {
      dispatch({
        type: "patched",
        value: { overlayError: "Não foi possível retomar a gravação." },
      });
      return;
    }

    recorder.resume();
    dispatch({
      type: "patched",
      value: {
        recordedBlob: null,
        recordedAt: null,
        overlayError: null,
        isPaused: false,
        overlayStage: "recording",
      },
    });
  }, [isStarting, meetingDraft, overlayStage]);

  const handleSaveRecording = useCallback(async () => {
    if (!meetingDraft) {
      dispatch({
        type: "patched",
        value: { overlayError: "Nenhuma gravação pronta para envio." },
      });
      return;
    }

    dispatch({
      type: "patched",
      value: {
        overlayStage: "saving",
        isMinimized: false,
        overlayError: null,
        uploadProgress: 0,
      },
    });

    try {
      const recording = mediaRecorderRef.current
        ? await stopActiveRecording()
        : recordedBlob;

      if (!recording) {
        dispatch({
          type: "patched",
          value: {
            overlayError: "Nenhuma gravação pronta para envio.",
            overlayStage: "confirm",
          },
        });
        return;
      }

      cleanupRecorderResources();
      const meetingId = await submitRecordedMeeting({
        whatsappNumber: meetingDraft.whatsappNumber,
        groupId: meetingDraft.groupId,
        recording,
        recordedAt: recordedAt ?? new Date(),
        onUploadProgress: (uploadProgress) =>
          dispatch({ type: "patched", value: { uploadProgress } }),
      });

      resetRecordingState();
      router.push(`/dashboard/processing?id=${meetingId}`);
    } catch (error) {
      console.error("[recording] failed to save recording", error);
      dispatch({
        type: "patched",
        value: {
          overlayError:
            "Sua gravação foi salva. Houve um erro no processamento, mas você pode tentar novamente na tela de reuniões.",
          overlayStage: "confirm",
          isMinimized: false,
        },
      });
    }
  }, [
    cleanupRecorderResources,
    meetingDraft,
    recordedAt,
    recordedBlob,
    resetRecordingState,
    router,
    stopActiveRecording,
  ]);

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
          isPaused={isPaused}
          onStop={handleStopRecording}
          onPauseToggle={handlePauseToggle}
          onResumeRecording={resumeStoppedRecording}
          onDiscard={resetRecordingState}
          onSave={handleSaveRecording}
          onClose={overlayError ? resetRecordingState : undefined}
          onMinimize={() =>
            dispatch({ type: "patched", value: { isMinimized: true } })
          }
        />
      ) : null}

      {overlayStage && isMinimized ? (
        <MinimizedRecordingController
          stage={overlayStage}
          elapsedLabel={elapsedLabel}
          uploadProgress={uploadProgress}
          isPaused={isPaused}
          onExpand={() =>
            dispatch({ type: "patched", value: { isMinimized: false } })
          }
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
