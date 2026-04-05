"use client";

import React, { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
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

// ─── Inner page (needs ToastProvider above) ───────────────────────────────────

function UploadPageInner() {
  const router = useRouter();
  const { show } = useToast();

  const [file, setFile] = useState<File | null>(null);
  const [progress, setProgress] = useState(0);
  const [timeRemaining, setTimeRemaining] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number>(0);

  // ── Simulate upload progress ──────────────────────────────────────────────

  const startProgress = useCallback(() => {
    startTimeRef.current = Date.now();
    setProgress(0);
    setTimeRemaining("");

    intervalRef.current = setInterval(() => {
      setProgress((prev) => {
        const increment = Math.random() * 4 + 2; // 2–6% per tick
        const next = Math.min(prev + increment, 100);

        // Estimate time remaining
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
    }, 300);
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

  // ── Form submit ───────────────────────────────────────────────────────────

  const handleSubmit = useCallback(
    async (data: MeetingFormData) => {
      if (!file) return;
      setIsSubmitting(true);
      try {
        const res = await fetch("/api/meetings/process", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            clientName: data.clientName,
            meetingDate: data.meetingDate,
            whatsappNumber: data.whatsappNumber,
            fileName: file.name,
            fileSize: file.size,
          }),
        });

        if (!res.ok) {
          const json = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(json.error ?? "Erro ao processar. Tente novamente.");
        }

        const { meetingId } = (await res.json()) as { meetingId: string };
        show("Reunião enviada com sucesso! Processando...", "success");
        router.push(`/dashboard/meetings/${meetingId}`);
      } catch (err) {
        show(err instanceof Error ? err.message : "Erro inesperado.", "error");
      } finally {
        setIsSubmitting(false);
      }
    },
    [file, router, show]
  );

  return (
    <div className="animate-fade-in min-h-full">
      {/* ── Breadcrumb ───────────────────────────────────────────────────── */}
      <nav className="mb-3 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-[#606060]">
        <Link href="/dashboard" className="transition-colors hover:text-[#A0A0A0]">
          Dashboard
        </Link>
        <ChevronRight className="h-3 w-3 text-[#3A3A3A]" />
        <span className="text-[#A0A0A0]">Nova Reunião</span>
      </nav>

      {/* ── Page title ───────────────────────────────────────────────────── */}
      <h1 className="font-display text-3xl font-extrabold text-white">
        Iniciar Processamento
      </h1>
      <p className="mt-1.5 max-w-lg text-sm text-[#A0A0A0]">
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

          {file ? (
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
        <div className="flex w-full shrink-0 flex-col gap-4 lg:w-[340px]">
          {/* PlanBadge (desktop) */}
          <div className="hidden lg:block">
            <PlanBadge used={7} total={10} />
          </div>

          {/* Meeting form */}
          <div
            className="rounded-2xl border p-5"
            style={{ background: "#1C1C1C", borderColor: "#2E2E2E" }}
          >
            <MeetingForm
              onSubmit={handleSubmit}
              onValidationError={(msg) => show(msg, "warning")}
              isSubmitting={isSubmitting}
              hasFile={!!file}
            />
          </div>

          {/* AI insight tip */}
          <AiInsightTip />
        </div>
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
