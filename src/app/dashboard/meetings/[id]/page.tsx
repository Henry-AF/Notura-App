"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  MessageCircle,
  Copy,
  Download,
  RefreshCw,
  CheckCircle,
  AlertCircle,
  Cpu,
  FileText,
  Sparkles,
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import {
  cn,
  formatDate,
  formatDuration,
  formatPhone,
  getInitials,
} from "@/lib/utils";
import type { MeetingWithRelations, MeetingJSON } from "@/types/database";

// ─── Processing State Component ─────────────────────────────────────────────

function ProcessingState({ currentStep }: { currentStep: number }) {
  const steps = [
    { label: "Transcrevendo" },
    { label: "Resumindo" },
    { label: "Enviando no WhatsApp" },
  ];

  return (
    <div className="flex flex-col items-center rounded-2xl border border-[rgba(199,196,215,0.2)] bg-[#f6f3f2] p-10">
      {/* Audio waveform animation */}
      <div className="mb-6 flex items-end gap-1">
        {[...Array(7)].map((_, i) => (
          <div
            key={i}
            className="w-1 rounded-full bg-[#4648d4]"
            style={{
              height: `${16 + Math.sin(i * 0.8) * 12}px`,
              animation: `waveform 1.2s ease-in-out ${i * 0.1}s infinite alternate`,
            }}
          />
        ))}
      </div>

      <h3 className="font-manrope font-extrabold text-lg text-[#1c1b1b] tracking-[-0.3px]">
        Processando sua reunião...
      </h3>
      <p className="mt-1 text-sm text-[#464554]">
        Isso geralmente leva de 2 a 5 minutos
      </p>

      {/* Step indicators */}
      <div className="mt-8 w-full max-w-xs space-y-3">
        {steps.map((step, i) => {
          const isActive = i === currentStep;
          const isDone = i < currentStep;
          return (
            <div key={i} className="flex items-center gap-3">
              {isDone ? (
                <div className="flex h-5 w-5 items-center justify-center rounded-full bg-[#4648d4]">
                  <CheckCircle className="h-3 w-3 text-white" />
                </div>
              ) : isActive ? (
                <div className="h-5 w-5 animate-pulse rounded-full border-2 border-[#4648d4] bg-[#e1e0ff]" />
              ) : (
                <div className="h-5 w-5 rounded-full border border-[rgba(199,196,215,0.6)]" />
              )}
              <span
                className={cn(
                  "text-sm",
                  isDone
                    ? "font-medium text-[#4648d4]"
                    : isActive
                    ? "font-medium text-[#1c1b1b]"
                    : "text-[#464554]"
                )}
              >
                {step.label}
                {isActive && "..."}
              </span>
            </div>
          );
        })}
      </div>

      {/* Inline CSS for waveform animation */}
      <style jsx>{`
        @keyframes waveform {
          from {
            transform: scaleY(0.5);
          }
          to {
            transform: scaleY(1.3);
          }
        }
      `}</style>
    </div>
  );
}

// ─── Mock Data ──────────────────────────────────────────────────────────────

const mockMeeting: MeetingWithRelations = {
  id: "m1",
  user_id: "u1",
  title: "Alinhamento trimestral — Equipe RH",
  client_name: "Interno",
  meeting_date: "2026-03-19",
  audio_r2_key: "meetings/u1/20260319/audio.mp3",
  transcript:
    "[00:00] Marcos: Bom dia pessoal, vamos começar o alinhamento trimestral.\n[00:15] Carla: Bom dia! Trouxe os números de turnover do Q1.\n[00:28] Marcos: Ótimo, vamos ver. Qual foi o resultado?\n[00:35] Carla: Turnover caiu pra 4.2%, abaixo da meta de 5%.\n[01:02] Marcos: Excelente. E o programa de onboarding, Julia?\n[01:10] Julia: Implementamos o novo fluxo na semana passada. Já temos feedback positivo dos últimos 3 contratados.\n[01:30] Marcos: Perfeito. Vamos aprovar a expansão do programa pra todas as unidades.\n[01:45] Carla: Marcos, precisamos decidir sobre o orçamento de treinamento pro Q2.\n[02:00] Marcos: Vamos manter o mesmo budget, R$45 mil, e revisar em maio.\n[02:20] Julia: Preciso que a Carla me envie a lista atualizada de colaboradores até sexta.\n[02:35] Marcos: Combinado. Próxima reunião em duas semanas, 2 de abril.",
  summary_whatsapp:
    "📋 *Alinhamento trimestral — Equipe RH*\n📅 19/mar/2026 | ⏱ 45 min | 👥 3 participantes\n\n✅ *Resumo:* Turnover Q1 abaixo da meta (4.2%). Novo onboarding aprovado para expansão. Orçamento Q2 mantido em R$45k.\n\n📌 *Decisões:*\n• Expandir programa de onboarding para todas as unidades\n• Manter orçamento de treinamento Q2 em R$45 mil\n\n📝 *Tarefas:*\n• Carla: Enviar lista de colaboradores atualizada → até 21/mar\n• Julia: Preparar cronograma de rollout do onboarding → até 26/mar\n• Marcos: Agendar revisão de budget em maio\n\n⚠️ *Em aberto:*\n• Definir fornecedor de treinamento presencial",
  summary_json: {
    version: "3.0",
    meeting: {
      title: "Alinhamento trimestral — Equipe RH",
      date_mentioned: "19 de março de 2026",
      duration_minutes: 45,
      participants: ["Marcos", "Carla", "Julia"],
      participant_count: 3,
    },
    decisions: [
      {
        description: "Expandir programa de onboarding para todas as unidades",
        decided_by: "Marcos",
        confidence: "alta",
      },
      {
        description: "Manter orçamento de treinamento Q2 em R$45 mil, revisão em maio",
        decided_by: "Marcos",
        confidence: "alta",
      },
    ],
    tasks: [
      {
        description: "Enviar lista de colaboradores atualizada",
        owner: "Carla",
        due_date: "2026-03-21",
        priority: "alta",
        status: "pendente",
      },
      {
        description: "Preparar cronograma de rollout do onboarding",
        owner: "Julia",
        due_date: "2026-03-26",
        priority: "média",
        status: "pendente",
      },
      {
        description: "Agendar revisão de budget em maio",
        owner: "Marcos",
        due_date: null,
        priority: "baixa",
        status: "pendente",
      },
    ],
    open_items: [
      {
        description: "Definir fornecedor de treinamento presencial",
        context:
          "Necessário para o programa expandido de onboarding. Carla vai pesquisar opções.",
      },
    ],
    next_meeting: {
      datetime: "2026-04-02",
      location_or_link: null,
    },
    summary_one_line:
      "Turnover Q1 abaixo da meta; onboarding expandido aprovado; orçamento Q2 mantido em R$45k.",
    metadata: {
      prompt_version: "v3.0",
      total_decisions: 2,
      total_tasks: 3,
      total_open_items: 1,
    },
  },
  whatsapp_number: "5511999887766",
  whatsapp_status: "sent",
  status: "completed",
  source: "upload",
  duration_seconds: 2700,
  cost_usd: 0.12,
  prompt_version: "v3.0",
  error_message: null,
  created_at: "2026-03-19T14:00:00.000Z",
  completed_at: "2026-03-19T14:05:00.000Z",
  tasks: [
    {
      id: "t1",
      meeting_id: "m1",
      user_id: "u1",
      dedupe_key: "task-1",
      description: "Enviar lista de colaboradores atualizada",
      owner: "Carla",
      due_date: "2026-03-21",
      priority: "alta",
      completed: false,
      completed_at: null,
      created_at: "2026-03-19T14:05:00.000Z",
    },
    {
      id: "t2",
      meeting_id: "m1",
      user_id: "u1",
      dedupe_key: "task-2",
      description: "Preparar cronograma de rollout do onboarding",
      owner: "Julia",
      due_date: "2026-03-26",
      priority: "média",
      completed: false,
      completed_at: null,
      created_at: "2026-03-19T14:05:00.000Z",
    },
    {
      id: "t3",
      meeting_id: "m1",
      user_id: "u1",
      dedupe_key: "task-3",
      description: "Agendar revisão de budget em maio",
      owner: "Marcos",
      due_date: null,
      priority: "baixa",
      completed: true,
      completed_at: "2026-03-19T16:00:00.000Z",
      created_at: "2026-03-19T14:05:00.000Z",
    },
  ],
  decisions: [
    {
      id: "d1",
      meeting_id: "m1",
      user_id: "u1",
      dedupe_key: "decision-1",
      description: "Expandir programa de onboarding para todas as unidades",
      decided_by: "Marcos",
      confidence: "alta",
      created_at: "2026-03-19T14:05:00.000Z",
    },
    {
      id: "d2",
      meeting_id: "m1",
      user_id: "u1",
      dedupe_key: "decision-2",
      description:
        "Manter orçamento de treinamento Q2 em R$45 mil, revisão em maio",
      decided_by: "Marcos",
      confidence: "alta",
      created_at: "2026-03-19T14:05:00.000Z",
    },
  ],
  open_items: [
    {
      id: "o1",
      meeting_id: "m1",
      user_id: "u1",
      dedupe_key: "open-item-1",
      description: "Definir fornecedor de treinamento presencial",
      context:
        "Necessário para o programa expandido de onboarding. Carla vai pesquisar opções.",
      created_at: "2026-03-19T14:05:00.000Z",
    },
  ],
};

// ─── Priority config helper ─────────────────────────────────────────────────

function priorityConfig(p: string) {
  if (p === "alta")
    return { label: "Alta", className: "bg-red-50 text-red-700" };
  if (p === "média")
    return { label: "Média", className: "bg-amber-50 text-amber-700" };
  return { label: "Baixa", className: "bg-emerald-50 text-emerald-700" };
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function MeetingDetailPage() {
  const meeting = mockMeeting;
  const summaryJson = meeting.summary_json as MeetingJSON | null;
  const [taskStates, setTaskStates] = useState<Record<string, boolean>>(
    Object.fromEntries(meeting.tasks.map((t) => [t.id, t.completed]))
  );

  const showProcessing = meeting.status === "processing";
  const toggleTask = (taskId: string) =>
    setTaskStates((prev) => ({ ...prev, [taskId]: !prev[taskId] }));

  const pendingCount = Object.values(taskStates).filter((v) => !v).length;
  const totalTasks = meeting.tasks.length;
  const completionPercent =
    totalTasks > 0
      ? Math.round(((totalTasks - pendingCount) / totalTasks) * 100)
      : 0;

  const participants = summaryJson?.meeting?.participants ?? [];

  if (showProcessing) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Link href="/dashboard">
            <button className="flex h-9 w-9 items-center justify-center rounded-full bg-[#e5e2e1] text-[#464554] transition-colors hover:bg-[#d9d5d3]">
              <ArrowLeft className="h-4 w-4" />
            </button>
          </Link>
          <h1 className="font-manrope font-extrabold text-2xl text-[#1c1b1b] tracking-[-0.3px]">
            {meeting.title || "Processando reunião..."}
          </h1>
        </div>
        <ProcessingState currentStep={1} />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* ── Header Section ─────────────────────────────────────────────────── */}
      <div className="space-y-5">
        {/* Back + status row */}
        <div className="flex items-center gap-3">
          <Link href="/dashboard">
            <button className="flex h-9 w-9 items-center justify-center rounded-full bg-[#e5e2e1] text-[#464554] transition-colors hover:bg-[#d9d5d3]">
              <ArrowLeft className="h-4 w-4" />
            </button>
          </Link>

          {/* Status badge */}
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[#e1e0ff] px-3 py-1 text-xs font-medium text-[#07006c]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#4648d4]" />
            {meeting.status === "completed"
              ? "Concluído"
              : meeting.status === "processing"
              ? "Processando"
              : "Erro"}
          </span>

          <span className="text-sm text-[#464554]">
            {formatDate(meeting.meeting_date)}
          </span>
          <span className="text-[#464554] opacity-30">·</span>
          <span className="text-sm text-[#464554]">
            {formatDuration(meeting.duration_seconds)}
          </span>
        </div>

        {/* Title + participants */}
        <div className="flex items-start justify-between gap-8">
          <div className="min-w-0 flex-1">
            <h1 className="font-manrope font-extrabold text-3xl leading-tight tracking-[-0.5px] text-[#1c1b1b]">
              {meeting.title}
            </h1>
            {summaryJson?.summary_one_line && (
              <p className="mt-2 max-w-2xl text-base leading-relaxed text-[#464554]">
                {summaryJson.summary_one_line}
              </p>
            )}
          </div>

          {/* Participant avatar stack */}
          {participants.length > 0 && (
            <div className="flex shrink-0 items-center">
              {participants.slice(0, 3).map((p, i) => (
                <div
                  key={p}
                  className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-[#fcf9f8] bg-[#e1e0ff] text-sm font-semibold text-[#07006c]"
                  style={{ marginLeft: i > 0 ? "-8px" : "0" }}
                  title={p}
                >
                  {getInitials(p)}
                </div>
              ))}
              {participants.length > 3 && (
                <div
                  className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-[#fcf9f8] bg-[#f6f3f2] text-xs font-semibold text-[#464554]"
                  style={{ marginLeft: "-8px" }}
                >
                  +{participants.length - 3}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Action buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <button className="inline-flex items-center gap-2 rounded-full bg-[#e5e2e1] px-4 py-2 text-sm font-medium text-[#464554] transition-colors hover:bg-[#d9d5d3]">
            <Copy className="h-4 w-4" />
            Copiar resumo
          </button>
          <button className="inline-flex items-center gap-2 rounded-full bg-[#e5e2e1] px-4 py-2 text-sm font-medium text-[#464554] transition-colors hover:bg-[#d9d5d3]">
            <Download className="h-4 w-4" />
            Baixar PDF
          </button>
          <button className="inline-flex items-center gap-2 rounded-full bg-[#e5e2e1] px-4 py-2 text-sm font-medium text-[#464554] transition-colors hover:bg-[#d9d5d3]">
            <FileText className="h-4 w-4" />
            Exportar JSON
          </button>
          <button
            className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium text-white transition-all hover:opacity-90"
            style={{
              background: "linear-gradient(135deg, #4648d4, #6063ee)",
              boxShadow:
                "0 10px 15px -3px rgba(70,72,212,0.2), 0 4px 6px -4px rgba(70,72,212,0.2)",
            }}
          >
            <MessageCircle className="h-4 w-4" />
            Reenviar WhatsApp
          </button>
        </div>
      </div>

      {/* ── Two-column layout ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        {/* Left column — 3/5 */}
        <div className="space-y-5 lg:col-span-3">

          {/* ── Summary Section ─────────────────────────────────────────── */}
          <div className="rounded-2xl border border-[rgba(199,196,215,0.2)] bg-[#f6f3f2] p-6">
            <div className="mb-5 flex items-center gap-2.5">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#e1e0ff]">
                <Sparkles className="h-4 w-4 text-[#4648d4]" />
              </div>
              <h2 className="font-manrope font-extrabold tracking-[-0.2px] text-[#1c1b1b]">
                Resumo Inteligente
              </h2>
            </div>

            <div className="rounded-xl border border-[rgba(199,196,215,0.3)] bg-white/60 p-4">
              <pre className="whitespace-pre-wrap font-body text-sm leading-relaxed text-[#1c1b1b]">
                {meeting.summary_whatsapp}
              </pre>
            </div>
          </div>

          {/* ── Decisions Section ───────────────────────────────────────── */}
          <div className="rounded-2xl border border-[rgba(199,196,215,0.2)] bg-[#f6f3f2] p-6">
            <div className="mb-5 flex items-center gap-2.5">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#e1e0ff]">
                <CheckCircle className="h-4 w-4 text-[#4648d4]" />
              </div>
              <h2 className="font-manrope font-extrabold tracking-[-0.2px] text-[#1c1b1b]">
                Decisões-chave
              </h2>
            </div>

            <ul className="space-y-4">
              {meeting.decisions.map((d) => (
                <li key={d.id} className="flex items-start gap-4">
                  <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-[rgba(199,196,215,0.6)]">
                    <div className="h-2 w-2 rounded-full bg-[#4648d4]" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-[#1c1b1b]">
                      {d.description}
                    </p>
                    <div className="mt-1.5 flex items-center gap-2">
                      {d.decided_by && (
                        <span className="text-xs text-[#464554]">
                          por {d.decided_by}
                        </span>
                      )}
                      <span
                        className={cn(
                          "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
                          d.confidence === "alta"
                            ? "bg-emerald-50 text-emerald-700"
                            : "bg-amber-50 text-amber-700"
                        )}
                      >
                        {d.confidence === "alta"
                          ? "Alta confiança"
                          : "Média confiança"}
                      </span>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          {/* ── Open Items Section ──────────────────────────────────────── */}
          {meeting.open_items.length > 0 && (
            <div className="rounded-2xl border border-[rgba(199,196,215,0.2)] bg-[#f6f3f2] p-6">
              <div className="mb-5 flex items-center gap-2.5">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-50">
                  <AlertCircle className="h-4 w-4 text-amber-600" />
                </div>
                <h2 className="font-manrope font-extrabold tracking-[-0.2px] text-[#1c1b1b]">
                  Itens em aberto
                </h2>
              </div>

              <ul className="space-y-3">
                {meeting.open_items.map((item) => (
                  <li key={item.id} className="flex items-start gap-4">
                    <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-amber-200 bg-amber-50">
                      <div className="h-2 w-2 rounded-full bg-amber-500" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-[#1c1b1b]">
                        {item.description}
                      </p>
                      {item.context && (
                        <p className="mt-1 text-xs text-[#464554]">
                          {item.context}
                        </p>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* ── Transcript Section ──────────────────────────────────────── */}
          <div className="rounded-2xl border border-[rgba(199,196,215,0.2)] bg-[#f6f3f2] p-6">
            <div className="mb-5 flex items-center gap-2.5">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#e1e0ff]">
                <FileText className="h-4 w-4 text-[#4648d4]" />
              </div>
              <h2 className="font-manrope font-extrabold tracking-[-0.2px] text-[#1c1b1b]">
                Transcrição
              </h2>
            </div>

            <div className="max-h-80 overflow-y-auto pr-1">
              <div className="space-y-5">
                {meeting.transcript
                  .split("\n")
                  .filter(Boolean)
                  .map((line, i) => {
                    const match = line.match(/^\[(.+?)\]\s*(.+?):\s*(.*)$/);
                    if (!match) return null;
                    const [, ts, speaker, text] = match;
                    return (
                      <div key={i} className="flex gap-3">
                        <div className="w-12 shrink-0 pt-0.5 text-xs text-[#464554]">
                          {ts}
                        </div>
                        <div className="flex-1 border-l-2 border-[rgba(199,196,215,0.4)] pl-4">
                          <div className="mb-0.5 text-xs font-semibold text-[#4648d4]">
                            {speaker}
                          </div>
                          <p className="text-sm leading-relaxed text-[#1c1b1b]">
                            {text}
                          </p>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          </div>
        </div>

        {/* Right column — 2/5 */}
        <div className="space-y-4 lg:col-span-2">

          {/* ── Tasks Card ──────────────────────────────────────────────── */}
          <div className="rounded-2xl border border-[rgba(199,196,215,0.2)] bg-[#f6f3f2] p-6">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="font-manrope font-extrabold tracking-[-0.2px] text-[#1c1b1b]">
                Tarefas
              </h2>
              <span className="inline-flex items-center rounded-full bg-[#e1e0ff] px-2.5 py-0.5 text-xs font-medium text-[#07006c]">
                {totalTasks} no total
              </span>
            </div>

            {/* Progress bar */}
            <div className="mb-5">
              <div className="mb-1.5 flex items-center justify-between text-xs text-[#464554]">
                <span>{pendingCount} pendentes</span>
                <span>{completionPercent}%</span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#e5e2e1]">
                <div
                  className="h-1.5 rounded-full transition-all duration-500"
                  style={{
                    width: `${completionPercent}%`,
                    background: "linear-gradient(90deg, #4648d4, #6063ee)",
                  }}
                />
              </div>
            </div>

            {/* Task list */}
            <ul className="space-y-3">
              {meeting.tasks.map((task) => {
                const isChecked = taskStates[task.id] ?? false;
                const p = priorityConfig(task.priority);
                return (
                  <li
                    key={task.id}
                    className={cn(
                      "rounded-xl border border-[rgba(199,196,215,0.3)] bg-white p-4 transition-opacity",
                      isChecked && "opacity-60"
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <Checkbox
                        checked={isChecked}
                        onCheckedChange={() => toggleTask(task.id)}
                        className="mt-0.5 shrink-0"
                      />
                      <div className="min-w-0 flex-1">
                        {/* Priority + due date row */}
                        <div className="mb-1.5 flex items-center justify-between gap-2">
                          <span
                            className={cn(
                              "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
                              p.className
                            )}
                          >
                            {p.label}
                          </span>
                          {task.due_date && (
                            <span className="shrink-0 text-xs text-[#464554]">
                              até {formatDate(task.due_date)}
                            </span>
                          )}
                        </div>

                        {/* Task description */}
                        <p
                          className={cn(
                            "text-sm leading-snug text-[#1c1b1b]",
                            isChecked && "line-through"
                          )}
                        >
                          {task.description}
                        </p>

                        {/* Assignee */}
                        {task.owner && (
                          <div className="mt-2 flex items-center gap-1.5">
                            <div className="flex h-5 w-5 items-center justify-center rounded-full bg-[#e1e0ff] text-[9px] font-semibold text-[#07006c]">
                              {getInitials(task.owner)}
                            </div>
                            <span className="text-xs text-[#464554]">
                              {task.owner}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>

          {/* ── WhatsApp Delivery Card ──────────────────────────────────── */}
          <div className="rounded-2xl border border-[rgba(199,196,215,0.2)] bg-[#f6f3f2] p-6">
            <div className="mb-4 flex items-center gap-2.5">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-50">
                <MessageCircle className="h-4 w-4 text-emerald-600" />
              </div>
              <h2 className="font-manrope font-extrabold tracking-[-0.2px] text-[#1c1b1b]">
                Entrega WhatsApp
              </h2>
            </div>

            <div className="space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-[#464554]">Número</span>
                <span className="font-medium text-[#1c1b1b]">
                  {formatPhone(meeting.whatsapp_number)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[#464554]">Enviado em</span>
                <span className="text-[#1c1b1b]">
                  {meeting.completed_at
                    ? formatDate(meeting.completed_at)
                    : "—"}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[#464554]">Status</span>
                <span
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
                    meeting.whatsapp_status === "sent"
                      ? "bg-emerald-50 text-emerald-700"
                      : meeting.whatsapp_status === "failed"
                      ? "bg-red-50 text-red-700"
                      : "bg-[#e1e0ff] text-[#07006c]"
                  )}
                >
                  <span
                    className={cn(
                      "h-1.5 w-1.5 rounded-full",
                      meeting.whatsapp_status === "sent"
                        ? "bg-emerald-500"
                        : meeting.whatsapp_status === "failed"
                        ? "bg-red-500"
                        : "bg-[#4648d4]"
                    )}
                  />
                  {meeting.whatsapp_status === "sent"
                    ? "Enviado"
                    : meeting.whatsapp_status === "failed"
                    ? "Falhou"
                    : "Pendente"}
                </span>
              </div>
            </div>
          </div>

          {/* ── Details Card ────────────────────────────────────────────── */}
          <div className="rounded-2xl border border-[rgba(199,196,215,0.2)] bg-[#f6f3f2] p-6">
            <div className="mb-4 flex items-center gap-2.5">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#e5e2e1]">
                <Cpu className="h-4 w-4 text-[#464554]" />
              </div>
              <h2 className="font-manrope font-extrabold tracking-[-0.2px] text-[#1c1b1b]">
                Detalhes
              </h2>
            </div>

            <div className="space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-[#464554]">Duração do áudio</span>
                <span className="text-[#1c1b1b]">
                  {formatDuration(meeting.duration_seconds)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[#464554]">Modelo</span>
                <span className="text-[#1c1b1b]">Gemini 2.5 Flash</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[#464554]">Custo</span>
                <span className="text-[#1c1b1b]">
                  US$ {meeting.cost_usd?.toFixed(2) ?? "—"}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[#464554]">Versão do prompt</span>
                <span className="inline-flex rounded-full bg-[#e5e2e1] px-2.5 py-0.5 text-xs font-medium text-[#464554]">
                  {meeting.prompt_version}
                </span>
              </div>
            </div>
          </div>

          {/* ── Reprocess Button ────────────────────────────────────────── */}
          <button className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#e5e2e1] px-4 py-2.5 text-sm font-medium text-[#464554] transition-colors hover:bg-[#d9d5d3]">
            <RefreshCw className="h-4 w-4" />
            Processar novamente
          </button>
        </div>
      </div>
    </div>
  );
}
