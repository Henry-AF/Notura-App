"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronRight, FileAudio, CheckCircle, Loader2 } from "lucide-react";
import {
  DropZone,
  UploadProgressCard,
  MeetingForm,
  PlanBadge,
  AiInsightTip,
  ToastProvider,
  useToast,
} from "@/components/upload";
import type { MeetingFormData } from "@/components/upload";
import { fetchNewMeetingDefaults } from "./new-api";

// ─── XHR upload with progress ────────────────────────────────────────────────

function uploadWithProgress(
  formData: FormData,
  onProgress: (pct: number) => void
): Promise<string> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/meetings/upload");

    xhr.upload.addEventListener("progress", (e) => {
      if (e.lengthComputable) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    });

    xhr.addEventListener("load", () => {
      if (xhr.status === 201 || xhr.status === 200) {
        try {
          const body = JSON.parse(xhr.responseText) as { meetingId?: string };
          if (body.meetingId) {
            resolve(body.meetingId);
          } else {
            reject(new Error("Resposta inválida do servidor."));
          }
        } catch {
          reject(new Error("Resposta inválida do servidor."));
        }
      } else {
        try {
          const err = JSON.parse(xhr.responseText) as { error?: string };
          reject(new Error(err.error ?? "Erro ao processar. Tente novamente."));
        } catch {
          reject(new Error(`Erro ${xhr.status}. Tente novamente.`));
        }
      }
    });

    xhr.addEventListener("error", () =>
      reject(new Error("Falha na conexão. Verifique sua internet."))
    );
    xhr.addEventListener("abort", () => reject(new Error("Upload cancelado.")));

    xhr.send(formData);
  });
}

// ─── Upload progress overlay ─────────────────────────────────────────────────

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
    <div className="flex min-h-[420px] flex-col items-center justify-center gap-8 rounded-2xl p-10" style={{ border: "1px solid rgb(var(--cn-border))", background: "rgb(var(--cn-card))" }}>
      {/* Spinning ring */}
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
            stroke="url(#uploadGrad)"
            strokeWidth="5"
            strokeLinecap="round"
            strokeDasharray="263.9"
            strokeDashoffset={
              isDone ? 0 : 263.9 - (progress / 100) * 263.9
            }
            style={{ transition: "stroke-dashoffset 0.5s ease" }}
          />
          <defs>
            <linearGradient id="uploadGrad" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#6851FF" />
              <stop offset="100%" stopColor="#8B7AFF" />
            </linearGradient>
          </defs>
        </svg>
        <div
          className="flex h-12 w-12 items-center justify-center rounded-full"
          style={{ background: "rgba(104,81,255,0.15)" }}
        >
          {isDone ? (
            <CheckCircle className="h-6 w-6 text-[#4ECB71]" />
          ) : (
            <FileAudio className="h-6 w-6 text-[#6851FF]" />
          )}
        </div>
      </div>

      {/* Label */}
      <div className="text-center">
        <p className="font-semibold text-white">
          {isDone ? "Upload concluído" : `Enviando... ${progress}%`}
        </p>
        <p className="mt-1 text-sm" style={{ color: "rgb(var(--cn-muted))" }}>
          {file.name} · {formatFileSize(file.size)}
        </p>
      </div>

      {/* Steps */}
      <div className="flex w-full max-w-xs flex-col gap-2.5">
        {steps.map((step, i) => (
          <div key={i} className="flex items-center gap-3">
            <div
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full"
              style={{
                background: step.done
                  ? "rgba(78,203,113,0.15)"
                  : step.active
                  ? "rgba(104,81,255,0.15)"
                  : "rgba(255,255,255,0.04)",
              }}
            >
              {step.done ? (
                <CheckCircle className="h-3.5 w-3.5 text-[#4ECB71]" />
              ) : step.active ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin text-[#6851FF]" />
              ) : (
                <span
                  className="text-[10px] font-bold"
                  style={{ color: "rgb(var(--cn-muted))" }}
                >
                  {i + 1}
                </span>
              )}
            </div>
            <span
              className="text-sm"
              style={{
                color: step.done ? "#4ECB71" : step.active ? "rgb(var(--cn-ink))" : "rgb(var(--cn-muted))",
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

// ─── Inner page (needs ToastProvider above) ───────────────────────────────────

function UploadPageInner() {
  const router = useRouter();
  const { show } = useToast();

  const [file, setFile] = useState<File | null>(null);
  const [progress, setProgress] = useState(0);
  const [timeRemaining, setTimeRemaining] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [uploadPct, setUploadPct] = useState(0);
  const [accountWhatsappNumber, setAccountWhatsappNumber] = useState("");

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number>(0);

  // ── Simulate file-read progress (cosmetic) ────────────────────────────────

  const startProgress = useCallback(() => {
    startTimeRef.current = Date.now();
    setProgress(0);
    setTimeRemaining("");

    intervalRef.current = setInterval(() => {
      setProgress((prev) => {
        const increment = Math.random() * 8 + 6; // faster: 1-2s to 100%
        const next = Math.min(prev + increment, 100);

        const elapsed = (Date.now() - startTimeRef.current) / 1000;
        const rate = next / elapsed;
        const remaining = rate > 0 ? Math.round((100 - next) / rate) : 0;
        setTimeRemaining(next >= 100 ? "" : `${remaining}s restantes`);

        if (next >= 100 && intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
        return next;
      });
    }, 200);
  }, []);

  const handleFile = useCallback(
    (f: File) => {
      setFile(f);
      startProgress();
    },
    [startProgress]
  );

  const handleRemove = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    setFile(null);
    setProgress(0);
    setTimeRemaining("");
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadDefaults() {
      try {
        const defaults = await fetchNewMeetingDefaults();
        if (!cancelled) {
          setAccountWhatsappNumber(defaults.accountWhatsappNumber);
        }
      } catch {
        if (!cancelled) {
          setAccountWhatsappNumber("");
        }
      }
    }

    void loadDefaults();
    return () => {
      cancelled = true;
    };
  }, []);

  // ── Submit: real XHR upload ───────────────────────────────────────────────

  const handleSubmit = useCallback(
    async (data: MeetingFormData) => {
      if (!file) return;

      setIsUploading(true);
      setUploadPct(0);

      const formData = new FormData();
      formData.append("audio", file);
      formData.append("client_name", data.clientName);
      formData.append("meeting_date", data.meetingDate);
      formData.append("whatsapp_number", data.whatsappNumber);

      try {
        const meetingId = await uploadWithProgress(formData, setUploadPct);
        // Brief pause so user sees 100%
        await new Promise<void>((r) => setTimeout(r, 600));
        router.push(`/dashboard/processing?id=${meetingId}`);
      } catch (err) {
        show(
          err instanceof Error ? err.message : "Erro inesperado.",
          "error"
        );
        setIsUploading(false);
        setUploadPct(0);
      }
    },
    [file, router, show]
  );

  return (
    <div className="animate-fade-in min-h-full">
      {/* ── Breadcrumb ───────────────────────────────────────────────────── */}
      <nav className="mb-3 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider" style={{ color: "rgb(var(--cn-muted))" }}>
        <Link href="/dashboard" className="transition-colors" style={{ color: "rgb(var(--cn-muted))" }} onMouseEnter={(e) => ((e.currentTarget as HTMLAnchorElement).style.color = "rgb(var(--cn-ink2))")} onMouseLeave={(e) => ((e.currentTarget as HTMLAnchorElement).style.color = "rgb(var(--cn-muted))")}>
          Dashboard
        </Link>
        <ChevronRight className="h-3 w-3" style={{ color: "rgb(var(--cn-border))" }} />
        <span style={{ color: "rgb(var(--cn-ink2))" }}>Nova Reunião</span>
      </nav>

      {/* ── Page title ───────────────────────────────────────────────────── */}
      <h1 className="font-display text-3xl font-extrabold" style={{ color: "rgb(var(--cn-ink))" }}>
        Iniciar Processamento
      </h1>
      <p className="mt-1.5 max-w-lg text-sm" style={{ color: "rgb(var(--cn-ink2))" }}>
        Transforme sua conversa em inteligência acionável. Envie o áudio e
        receba o resumo em instantes.
      </p>

      {/* ── Two-column layout ─────────────────────────────────────────────── */}
      <div className="mt-8 flex flex-col gap-6 lg:flex-row lg:items-start lg:gap-8">
        {/* Left column */}
        <div className="flex min-w-0 flex-1 flex-col gap-4">
          {/* PlanBadge (visible on mobile, above dropzone) */}
          <div className="lg:hidden">
            <PlanBadge used={7} total={10} />
          </div>

          {isUploading ? (
            <UploadingOverlay file={file!} progress={uploadPct} />
          ) : file ? (
            <UploadProgressCard
              file={file}
              progress={progress}
              timeRemaining={timeRemaining}
              onRemove={handleRemove}
            />
          ) : (
            <DropZone
              onFile={handleFile}
              onError={(msg) => show(msg, "error")}
            />
          )}
        </div>

        {/* Right column */}
        {!isUploading && (
          <div className="flex w-full shrink-0 flex-col gap-4 lg:w-[340px]">
            {/* PlanBadge (desktop) */}
            <div className="hidden lg:block">
              <PlanBadge used={7} total={10} />
            </div>

            {/* Meeting form */}
            <div
              className="rounded-2xl border p-5"
              style={{ background: "rgb(var(--cn-card))", borderColor: "rgb(var(--cn-border))" }}
            >
              <MeetingForm
                onSubmit={handleSubmit}
                onValidationError={(msg) => show(msg, "warning")}
                isSubmitting={false}
                hasFile={!!file}
                accountWhatsappNumber={accountWhatsappNumber}
              />
            </div>

            {/* AI insight tip */}
            <AiInsightTip />
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Page export (wraps with ToastProvider) ───────────────────────────────────

export default function NewMeetingPage() {
  return (
    <ToastProvider>
      <UploadPageInner />
    </ToastProvider>
  );
}
