"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
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
  onValidationError: (message: string) => void;
  onUnexpectedError: (message: string) => void;
  onUploadComplete: (meetingId: string) => void;
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
      <div className="relative flex h-20 w-20 items-center justify-center">
        <svg
          className="absolute inset-0 h-full w-full -rotate-90"
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
          className="flex h-12 w-12 items-center justify-center rounded-full"
          style={{ background: "rgba(245,158,11,0.18)" }}
        >
          {isDone ? (
            <CheckCircle className="h-6 w-6 text-[#4ECB71]" />
          ) : (
            <FileAudio className="h-6 w-6 text-[#F59E0B]" />
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
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full"
              style={{
                background: step.done
                  ? "rgba(78,203,113,0.15)"
                  : step.active
                    ? "rgba(245,158,11,0.18)"
                    : "rgba(255,255,255,0.04)",
              }}
            >
              {step.done ? (
                <CheckCircle className="h-3.5 w-3.5 text-[#4ECB71]" />
              ) : step.active ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin text-[#F59E0B]" />
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
  ref: React.MutableRefObject<ReturnType<typeof setInterval> | null>
) {
  if (ref.current) {
    clearInterval(ref.current);
    ref.current = null;
  }
}

export function RecordingUploadPanel({
  accountWhatsappNumber,
  onValidationError,
  onUnexpectedError,
  onUploadComplete,
}: RecordingUploadPanelProps) {
  const [file, setFile] = useState<File | null>(null);
  const [progress, setProgress] = useState(0);
  const [timeRemaining, setTimeRemaining] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [uploadPct, setUploadPct] = useState(0);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number>(0);

  const startUploadPreviewProgress = useCallback(() => {
    clearIntervalRef(intervalRef);
    startTimeRef.current = Date.now();
    setProgress(0);
    setTimeRemaining("");

    intervalRef.current = setInterval(() => {
      setProgress((current) => {
        const next = Math.min(current + Math.random() * 8 + 6, 100);
        const elapsed = (Date.now() - startTimeRef.current) / 1000;
        const rate = next / elapsed;
        const remaining = rate > 0 ? Math.round((100 - next) / rate) : 0;
        setTimeRemaining(next >= 100 ? "" : `${remaining}s restantes`);

        if (next >= 100) {
          clearIntervalRef(intervalRef);
        }

        return next;
      });
    }, 200);
  }, []);

  const handleFile = useCallback(
    (nextFile: File) => {
      setFile(nextFile);
      startUploadPreviewProgress();
    },
    [startUploadPreviewProgress]
  );

  const resetUploadSelection = useCallback(() => {
    clearIntervalRef(intervalRef);
    setFile(null);
    setProgress(0);
    setTimeRemaining("");
    setIsUploading(false);
    setUploadPct(0);
  }, []);

  const handleSubmit = useCallback(
    async (data: MeetingFormData) => {
      if (!file) {
        return;
      }

      setIsUploading(true);
      setUploadPct(0);

      try {
        const meetingId = await submitUploadedMeeting({
          clientName: data.clientName,
          meetingDate: data.meetingDate,
          whatsappNumber: data.whatsappNumber,
          file,
          onUploadProgress: setUploadPct,
        });

        onUploadComplete(meetingId);
      } catch (error) {
        onUnexpectedError(
          error instanceof Error ? error.message : "Erro inesperado no upload."
        );
        setIsUploading(false);
        setUploadPct(0);
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
