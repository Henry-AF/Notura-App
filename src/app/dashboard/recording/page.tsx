"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ChevronRight } from "lucide-react";
import {
  AiInsightTip,
  DropZone,
  ToastProvider,
  UploadProgressCard,
  useToast,
} from "@/components/upload";
import {
  RecordingOverlay,
  RecordingSetupCard,
  type RecordingMode,
  type RecordingOverlayStage,
  type RecordingSetupValues,
} from "@/components/recording";
import { LoadingState } from "@/components/ui/app";
import { Grainient } from "@/components/ui/grainient";
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
import { submitUploadedMeeting } from "./recording-upload-api";

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

function getInitialRecordingMode(mode: string | null): RecordingMode {
  if (mode === "remote") return "remote";
  if (mode === "upload") return "upload";
  return "in-person";
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

const GRAINIENT_COLORS = {
  "in-person": { color1: "#6851FF", color2: "#9B87FF", color3: "#1A0F4E" },
  remote: { color1: "#059669", color2: "#34D399", color3: "#022C22" },
  upload: { color1: "#D97706", color2: "#F59E0B", color3: "#78350F" },
} as const;

function RecordingPageHeader({ mode }: { mode: RecordingMode }) {
  const isRemote = mode === "remote";
  const isUpload = mode === "upload";
  const title = isUpload
    ? "Enviar Arquivo de Reunião"
    : isRemote
      ? "Gravar Reunião Remota"
      : "Gravar Reunião Presencial";
  const breadcrumb = isUpload ? "Upload de arquivo" : "Gravação ao vivo";
  const description = isUpload
    ? "Envie o áudio ou vídeo da reunião e deixe que a IA cuide do resto."
    : "Inicie a gravação, confirme ao encerrar e deixe que a IA cuide do resto.";
  const colors = GRAINIENT_COLORS[mode];

  return (
    <div className="relative overflow-hidden rounded-2xl">
      <div className="absolute inset-0">
        <Grainient
          color1={colors.color1}
          color2={colors.color2}
          color3={colors.color3}
          timeSpeed={0.15}
          grainAmount={0.06}
          zoom={0.85}
          warpStrength={0.8}
          contrast={1.2}
          saturation={0.9}
        />
      </div>
      <div className="relative z-10 px-4 pb-8 pt-7 sm:px-6 sm:pb-14 sm:pt-10">
        <nav
          aria-label="Breadcrumb"
          className="mb-2 flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider text-white/60 sm:mb-3 sm:text-[11px]"
        >
          <Link href="/dashboard" className="transition-colors hover:text-white/90">
            Dashboard
          </Link>
          <ChevronRight className="h-3 w-3 text-white/40" />
          <span className="text-white/80">{breadcrumb}</span>
        </nav>
        <h1 className="font-display text-[28px] font-extrabold text-white [text-shadow:0_1px_8px_rgba(0,0,0,0.3)] sm:text-3xl">
          <span key={mode} className="animate-fade-in inline-block">
            {title}
          </span>
        </h1>
        <p className="mt-1 max-w-lg text-[13px] text-white/75 [text-shadow:0_1px_4px_rgba(0,0,0,0.25)] sm:mt-1.5 sm:text-sm">
          {description}
        </p>
      </div>
    </div>
  );
}

function RecordingPageInner() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { show } = useToast();

  const [accountWhatsappNumber, setAccountWhatsappNumber] = useState("");
  const [isLoadingDefaults, setIsLoadingDefaults] = useState(true);
  const [isStarting, setIsStarting] = useState(false);
  const [recordingMode, setRecordingMode] = useState<RecordingMode>(
    getInitialRecordingMode(searchParams.get("mode"))
  );
  const [overlayStage, setOverlayStage] =
    useState<RecordingOverlayStage | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [recordedAt, setRecordedAt] = useState<Date | null>(null);
  const [meetingDraft, setMeetingDraft] = useState<MeetingDraft | null>(null);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadPreviewProgress, setUploadPreviewProgress] = useState(0);
  const [uploadTimeRemaining, setUploadTimeRemaining] = useState("");
  const [uploadProgress, setUploadProgress] = useState(0);
  const [overlayError, setOverlayError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const captureCleanupRef = useRef<(() => void) | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const uploadTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const uploadStartTimeRef = useRef<number>(0);

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

  const clearUploadPreviewTimer = useCallback(() => {
    if (uploadTimerRef.current) {
      clearInterval(uploadTimerRef.current);
      uploadTimerRef.current = null;
    }
  }, []);

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

  const resetUploadState = useCallback(() => {
    clearUploadPreviewTimer();
    setUploadFile(null);
    setUploadPreviewProgress(0);
    setUploadTimeRemaining("");
    setUploadProgress(0);
  }, [clearUploadPreviewTimer]);

  const updateModeUrl = useCallback(
    (mode: RecordingMode) => {
      const nextParams = new URLSearchParams(searchParams.toString());

      if (mode === "in-person") {
        nextParams.delete("mode");
      } else {
        nextParams.set("mode", mode);
      }

      const nextQuery = nextParams.toString();
      router.replace(nextQuery ? `${pathname}?${nextQuery}` : pathname);
    },
    [pathname, router, searchParams]
  );

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
      clearUploadPreviewTimer();
    };
  }, [cleanupRecorderResources, clearUploadPreviewTimer, show]);

  useEffect(() => {
    setRecordingMode(getInitialRecordingMode(searchParams.get("mode")));
  }, [searchParams]);

  useEffect(() => {
    const main = document.querySelector("main");

    if (main instanceof HTMLElement) {
      main.scrollTo({ top: 0, behavior: "auto" });
    }
  }, [recordingMode]);

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

  const startUploadPreviewProgress = useCallback(() => {
    clearUploadPreviewTimer();
    uploadStartTimeRef.current = Date.now();
    setUploadPreviewProgress(0);
    setUploadTimeRemaining("");

    uploadTimerRef.current = setInterval(() => {
      setUploadPreviewProgress((current) => {
        const next = Math.min(current + Math.random() * 8 + 6, 100);
        const elapsed = (Date.now() - uploadStartTimeRef.current) / 1000;
        const rate = next / elapsed;
        const remaining = rate > 0 ? Math.round((100 - next) / rate) : 0;
        setUploadTimeRemaining(next >= 100 ? "" : `${remaining}s restantes`);

        if (next >= 100) {
          clearUploadPreviewTimer();
        }

        return next;
      });
    }, 200);
  }, [clearUploadPreviewTimer]);

  const handleFile = useCallback(
    (file: File) => {
      setUploadFile(file);
      startUploadPreviewProgress();
    },
    [startUploadPreviewProgress]
  );

  const handleStartRecording = useCallback(
    async (values: RecordingSetupValues) => {
      if (values.recordingMode === "upload") {
        if (!uploadFile || !values.meetingDate) {
          return;
        }

        setIsStarting(true);
        setUploadProgress(0);
        setOverlayError(null);

        try {
          const meetingId = await submitUploadedMeeting({
            clientName: values.clientName,
            meetingDate: values.meetingDate,
            whatsappNumber: values.whatsappNumber,
            file: uploadFile,
            onUploadProgress: setUploadProgress,
          });

          router.push(`/dashboard/processing?id=${meetingId}`);
        } catch (error) {
          show(
            error instanceof Error ? error.message : "Erro ao processar upload.",
            "error"
          );
        } finally {
          setIsStarting(false);
        }

        return;
      }

      const isRemoteMode = values.recordingMode === "remote";

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
          capture = await createRecordingCapture(
            isRemoteMode ? "remote" : "in-person"
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
    [router, show, uploadFile]
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
      const technicalMessage =
        error instanceof Error
          ? error.message
          : "Erro ao salvar a gravação.";
      const userMessage =
        "Sua gravação foi salva. Houve um erro no processamento, mas você pode tentar novamente na tela de reuniões.";
      setOverlayError(userMessage);
      setOverlayStage("confirm");
      show(technicalMessage, "error");
    }
  }, [meetingDraft, recordedAt, recordedBlob, router, show]);

  const handleRecordingModeChange = useCallback(
    (mode: RecordingMode) => {
      if (overlayStage || isStarting) {
        show(
          "Finalize ou descarte a gravação atual antes de trocar de modo.",
          "warning"
        );
        return;
      }

      setRecordingMode(mode);
      if (mode !== "upload") {
        resetUploadState();
      }
      updateModeUrl(mode);
    },
    [isStarting, overlayStage, resetUploadState, show, updateModeUrl]
  );

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
              hasUploadFile={!!uploadFile}
              isStarting={isStarting}
              recordingMode={recordingMode}
              onRecordingModeChange={handleRecordingModeChange}
              onStart={handleStartRecording}
              onValidationError={(message) => show(message, "warning")}
              uploadField={
                recordingMode === "upload"
                  ? uploadFile
                    ? (
                        <UploadProgressCard
                          file={uploadFile}
                          progress={uploadPreviewProgress}
                          timeRemaining={uploadTimeRemaining}
                          onRemove={resetUploadState}
                        />
                      )
                    : (
                        <DropZone
                          onFile={handleFile}
                          onError={(message) => show(message, "error")}
                          compact
                        />
                      )
                : undefined
              }
            />
          </div>

          <div className="w-full shrink-0 lg:w-[340px]">
            <AiInsightTip />
          </div>
        </div>
      </div>

      {recordingMode !== "upload" && overlayStage ? (
        <RecordingOverlay
          stage={overlayStage}
          elapsedLabel={formatRecordingDuration(elapsedSeconds)}
          uploadProgress={uploadProgress}
          errorMessage={overlayError}
          onStop={handleStopRecording}
          onDiscard={resetRecordingState}
          onSave={handleSaveRecording}
          onClose={overlayError ? resetRecordingState : undefined}
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
