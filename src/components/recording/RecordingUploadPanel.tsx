"use client";

import React, { useCallback, useEffect, useReducer, useRef } from "react";
import { CheckCircle, FileAudio, Loader2 } from "lucide-react";
import {
  AiInsightTip,
  DropZone,
  MeetingForm,
  type MeetingFormData,
  UploadProgressCard,
} from "@/components/upload";
import { submitUploadedMeeting } from "@/app/dashboard/recording/recording-upload-api";

interface RecordingUploadPanelProps {
  accountWhatsappNumber: string;
  canSendWhatsAppSummary?: boolean;
  onValidationError: (message: string) => void;
  onUnexpectedError: (message: string) => void;
  onUploadComplete: (meetingId: string) => void;
}

type UploadPanelState = {
  file: File | null;
  progress: number;
  timeRemaining: string;
  isUploading: boolean;
  uploadPct: number;
};

type UploadPanelAction =
  | { type: "fileSelected"; file: File }
  | { type: "previewReset" }
  | { type: "previewTick"; progress: number; timeRemaining: string }
  | { type: "uploadStarted" }
  | { type: "uploadProgressChanged"; value: number }
  | { type: "uploadFailed" };

const initialUploadPanelState: UploadPanelState = {
  file: null,
  progress: 0,
  timeRemaining: "",
  isUploading: false,
  uploadPct: 0,
};

function uploadPanelReducer(
  state: UploadPanelState,
  action: UploadPanelAction
): UploadPanelState {
  switch (action.type) {
    case "fileSelected":
      return { ...state, file: action.file, progress: 0, timeRemaining: "" };
    case "previewReset":
      return initialUploadPanelState;
    case "previewTick":
      return {
        ...state,
        progress: action.progress,
        timeRemaining: action.timeRemaining,
      };
    case "uploadStarted":
      return { ...state, isUploading: true, uploadPct: 0 };
    case "uploadProgressChanged":
      return { ...state, uploadPct: action.value };
    case "uploadFailed":
      return { ...state, isUploading: false, uploadPct: 0 };
  }
}

function formatFileSize(bytes: number): string {
  if (bytes < 1_048_576) return `${(bytes / 1_024).toFixed(1)} KB`;
  return `${(bytes / 1_048_576).toFixed(1)} MB`;
}

function UploadingOverlay({
  file,
  progress,
}: {
  file: File;
  progress: number;
}) {
  const isDone = progress >= 100;
  const steps = [
    { label: "Enviando áudio", done: isDone, active: !isDone },
    { label: "Iniciando transcrição", done: false, active: isDone },
    { label: "Análise com IA", done: false, active: false },
  ];

  return (
    <div
      className="flex min-h-[420px] flex-col items-center justify-center gap-8 rounded-2xl p-10"
      style={{
        border: "1px solid rgb(var(--cn-border))",
        background: "rgb(var(--cn-card))",
      }}
    >
      <div className="relative flex size-20 items-center justify-center">
        <svg
          className="absolute inset-0 size-full -rotate-90"
          viewBox="0 0 100 100"
          fill="none"
        >
          <circle cx="50" cy="50" r="42" stroke="rgba(58,61,74,0.4)" strokeWidth="5" />
          <circle
            cx="50"
            cy="50"
            r="42"
            stroke="url(#uploadGradRecording)"
            strokeWidth="5"
            strokeLinecap="round"
            strokeDasharray="263.9"
            strokeDashoffset={isDone ? 0 : 263.9 - (progress / 100) * 263.9}
            style={{ transition: "stroke-dashoffset 0.5s ease" }}
          />
          <defs>
            <linearGradient id="uploadGradRecording" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#F59E0B" />
              <stop offset="100%" stopColor="#FCD34D" />
            </linearGradient>
          </defs>
        </svg>
        <div
          className="flex size-12 items-center justify-center rounded-full"
          style={{ background: "rgba(245,158,11,0.18)" }}
        >
          {isDone ? (
            <CheckCircle className="size-6 text-[#4ECB71]" />
          ) : (
            <FileAudio className="size-6 text-[#F59E0B]" />
          )}
        </div>
      </div>

      <div className="text-center">
        <p className="font-semibold text-white">
          {isDone ? "Upload concluído" : `Enviando... ${progress}%`}
        </p>
        <p className="mt-1 text-sm" style={{ color: "rgb(var(--cn-muted))" }}>
          {file.name} · {formatFileSize(file.size)}
        </p>
      </div>

      <div className="flex w-full max-w-xs flex-col gap-2.5">
        {steps.map((step, index) => (
          <div key={step.label} className="flex items-center gap-3">
            <div
              className="flex size-6 shrink-0 items-center justify-center rounded-full"
              style={{
                background: step.done
                  ? "rgba(78,203,113,0.15)"
                  : step.active
                    ? "rgba(245,158,11,0.18)"
                    : "rgba(255,255,255,0.04)",
              }}
            >
              {step.done ? (
                <CheckCircle className="size-3.5 text-[#4ECB71]" />
              ) : step.active ? (
                <Loader2 className="size-3.5 animate-spin text-[#F59E0B]" />
              ) : (
                <span
                  className="text-[10px] font-bold"
                  style={{ color: "rgb(var(--cn-muted))" }}
                >
                  {index + 1}
                </span>
              )}
            </div>
            <span
              className="text-sm"
              style={{
                color: step.done
                  ? "#4ECB71"
                  : step.active
                    ? "rgb(var(--cn-ink))"
                    : "rgb(var(--cn-muted))",
                fontWeight: step.active ? 500 : 400,
              }}
            >
              {step.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function clearIntervalRef(
  ref: React.MutableRefObject<number | null>
) {
  if (ref.current) {
    window.clearInterval(ref.current);
    ref.current = null;
  }
}

export function RecordingUploadPanel({
  accountWhatsappNumber,
  canSendWhatsAppSummary = true,
  onValidationError,
  onUnexpectedError,
  onUploadComplete,
}: RecordingUploadPanelProps) {
  const [state, dispatch] = useReducer(
    uploadPanelReducer,
    initialUploadPanelState
  );
  const { file, progress, timeRemaining, isUploading, uploadPct } = state;

  const intervalRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(0);
  const previewProgressRef = useRef(0);

  const startUploadPreviewProgress = useCallback(() => {
    clearIntervalRef(intervalRef);
    startTimeRef.current = Date.now();
    previewProgressRef.current = 0;
    dispatch({ type: "previewTick", progress: 0, timeRemaining: "" });

    intervalRef.current = window.setInterval(() => {
      const next = Math.min(previewProgressRef.current + Math.random() * 8 + 6, 100);
      previewProgressRef.current = next;
      const elapsed = (Date.now() - startTimeRef.current) / 1000;
      const rate = next / elapsed;
      const remaining = rate > 0 ? Math.round((100 - next) / rate) : 0;
      dispatch({
        type: "previewTick",
        progress: next,
        timeRemaining: next >= 100 ? "" : `${remaining}s restantes`,
      });

      if (next >= 100) {
        clearIntervalRef(intervalRef);
      }
    }, 200);
  }, []);

  const handleFile = useCallback(
    (nextFile: File) => {
      dispatch({ type: "fileSelected", file: nextFile });
      startUploadPreviewProgress();
    },
    [startUploadPreviewProgress]
  );

  const resetUploadSelection = useCallback(() => {
    clearIntervalRef(intervalRef);
    previewProgressRef.current = 0;
    dispatch({ type: "previewReset" });
  }, []);

  const handleSubmit = useCallback(
    async (data: MeetingFormData) => {
      if (!file) {
        return;
      }

      dispatch({ type: "uploadStarted" });

      try {
        const meetingId = await submitUploadedMeeting({
          meetingDate: data.meetingDate,
          whatsappNumber: data.whatsappNumber,
          file,
          onUploadProgress: (value) =>
            dispatch({ type: "uploadProgressChanged", value }),
        });

        onUploadComplete(meetingId);
      } catch (error) {
        onUnexpectedError(
          error instanceof Error ? error.message : "Erro inesperado no upload."
        );
        dispatch({ type: "uploadFailed" });
      }
    },
    [file, onUnexpectedError, onUploadComplete]
  );

  useEffect(() => {
    return () => clearIntervalRef(intervalRef);
  }, []);

  return (
    <div className="mt-8 flex justify-end">
      {isUploading ? (
        <div className="w-full lg:w-[340px]">
          <UploadingOverlay file={file!} progress={uploadPct} />
        </div>
      ) : (
        <div className="flex w-full shrink-0 flex-col gap-4 lg:w-[340px]">
          <div
            className="rounded-2xl border p-5"
            style={{
              background: "rgb(var(--cn-card))",
              borderColor: "rgb(var(--cn-border))",
            }}
          >
            <MeetingForm
              onSubmit={handleSubmit}
              onValidationError={onValidationError}
              isSubmitting={false}
              hasFile={!!file}
              accountWhatsappNumber={accountWhatsappNumber}
              canSendWhatsAppSummary={canSendWhatsAppSummary}
              fileField={
                file ? (
                  <UploadProgressCard
                    file={file}
                    progress={progress}
                    timeRemaining={timeRemaining}
                    onRemove={resetUploadSelection}
                  />
                ) : (
                  <DropZone
                    onFile={handleFile}
                    onError={onUnexpectedError}
                    compact
                  />
                )
              }
            />
          </div>

          <AiInsightTip />
        </div>
      )}
    </div>
  );
}
