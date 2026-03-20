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
  Circle,
  AlertCircle,
  Cpu,
  ListTodo,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/ui/accordion";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  cn,
  formatDate,
  formatDuration,
  formatPhone,
  getInitials,
} from "@/lib/utils";
import type { MeetingWithRelations } from "@/types/database";

// ─── Processing State Component ─────────────────────────────────────────────

function ProcessingState({ currentStep }: { currentStep: number }) {
  const steps = [
    { label: "Transcrevendo", icon: Circle },
    { label: "Resumindo", icon: Circle },
    { label: "Enviando no WhatsApp", icon: Circle },
  ];

  return (
    <Card className="border-notura-green/20 bg-notura-green-light/30">
      <CardContent className="flex flex-col items-center py-12">
        {/* Audio waveform animation */}
        <div className="mb-6 flex items-center gap-1">
          {[...Array(7)].map((_, i) => (
            <div
              key={i}
              className="w-1 rounded-full bg-notura-green"
              style={{
                height: `${16 + Math.sin(i * 0.8) * 12}px`,
                animation: `waveform 1.2s ease-in-out ${i * 0.1}s infinite alternate`,
              }}
            />
          ))}
        </div>

        <h3 className="font-display text-lg font-semibold text-notura-ink">
          Processando sua reunião...
        </h3>
        <p className="mt-1 text-sm text-notura-muted">
          Isso geralmente leva de 2 a 5 minutos
        </p>

        {/* Step indicators */}
        <div className="mt-8 space-y-3">
          {steps.map((step, i) => {
            const isActive = i === currentStep;
            const isDone = i < currentStep;
            return (
              <div key={i} className="flex items-center gap-3">
                {isDone ? (
                  <CheckCircle className="h-5 w-5 text-notura-green" />
                ) : isActive ? (
                  <div className="h-5 w-5 animate-pulse rounded-full border-2 border-notura-green bg-notura-green-light" />
                ) : (
                  <Circle className="h-5 w-5 text-notura-muted/40" />
                )}
                <span
                  className={cn(
                    "text-sm",
                    isDone
                      ? "font-medium text-notura-green"
                      : isActive
                      ? "font-medium text-notura-ink"
                      : "text-notura-muted"
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
      </CardContent>
    </Card>
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
      description: "Expandir programa de onboarding para todas as unidades",
      decided_by: "Marcos",
      confidence: "alta",
      created_at: "2026-03-19T14:05:00.000Z",
    },
    {
      id: "d2",
      meeting_id: "m1",
      user_id: "u1",
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
      description: "Definir fornecedor de treinamento presencial",
      context:
        "Necessário para o programa expandido de onboarding. Carla vai pesquisar opções.",
      created_at: "2026-03-19T14:05:00.000Z",
    },
  ],
};

// ─── Priority variant helper ────────────────────────────────────────────────

function priorityVariant(p: string) {
  if (p === "alta") return "priority-alta" as const;
  if (p === "média") return "priority-media" as const;
  return "priority-baixa" as const;
}

function priorityLabel(p: string) {
  if (p === "alta") return "Alta";
  if (p === "média") return "Média";
  return "Baixa";
}

function confidenceVariant(c: string) {
  return c === "alta" ? "completed" : "processing";
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function MeetingDetailPage() {
  const meeting = mockMeeting;
  const [taskStates, setTaskStates] = useState<Record<string, boolean>>(
    Object.fromEntries(meeting.tasks.map((t) => [t.id, t.completed]))
  );

  // Toggle to see processing state: change to "processing"
  const showProcessing = meeting.status === "processing";

  const toggleTask = (taskId: string) => {
    setTaskStates((prev) => ({ ...prev, [taskId]: !prev[taskId] }));
  };

  const pendingCount = Object.values(taskStates).filter((v) => !v).length;
  const totalTasks = meeting.tasks.length;
  const completionPercent =
    totalTasks > 0
      ? Math.round(((totalTasks - pendingCount) / totalTasks) * 100)
      : 0;

  if (showProcessing) {
    return (
      <div>
        <div className="mb-6 flex items-center gap-3">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/dashboard">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <h1 className="font-display text-2xl font-semibold text-notura-ink">
            {meeting.title || "Processando reunião..."}
          </h1>
        </div>
        <ProcessingState currentStep={1} />
      </div>
    );
  }

  return (
    <div>
      {/* Back button */}
      <div className="mb-6 flex items-center gap-3">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/dashboard">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <span className="text-sm text-notura-muted">Voltar</span>
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        {/* Left column — 60% */}
        <div className="lg:col-span-3 space-y-6">
          {/* Header */}
          <div>
            <h1 className="font-display text-2xl font-semibold text-notura-ink">
              {meeting.title}
            </h1>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-notura-muted">
              <span>{formatDate(meeting.meeting_date)}</span>
              <span className="text-notura-border">·</span>
              <span>{formatDuration(meeting.duration_seconds)}</span>
              <span className="text-notura-border">·</span>
              <div className="flex items-center gap-1">
                {meeting.summary_json?.meeting.participants.map((p) => (
                  <Badge key={p} variant="default" className="text-xs">
                    {p}
                  </Badge>
                ))}
              </div>
            </div>

            {/* Action buttons */}
            <div className="mt-4 flex flex-wrap gap-2">
              <Button variant="secondary" size="sm" className="gap-2">
                <MessageCircle className="h-3.5 w-3.5" />
                Reenviar WhatsApp
              </Button>
              <Button variant="secondary" size="sm" className="gap-2">
                <Copy className="h-3.5 w-3.5" />
                Copiar resumo
              </Button>
              <Button variant="secondary" size="sm" className="gap-2">
                <Download className="h-3.5 w-3.5" />
                Exportar PDF
              </Button>
            </div>
          </div>

          {/* Accordion sections */}
          <Accordion
            type="multiple"
            defaultValue={["resumo", "decisoes", "tarefas"]}
          >
            {/* Resumo */}
            <AccordionItem value="resumo">
              <AccordionTrigger>Resumo</AccordionTrigger>
              <AccordionContent>
                {/* One-line summary callout */}
                <div className="mb-4 rounded-md border border-notura-green/20 bg-notura-green-light/30 p-3">
                  <p className="text-sm font-medium text-notura-green">
                    {meeting.summary_json?.summary_one_line}
                  </p>
                </div>
                {/* WhatsApp formatted text */}
                <pre className="whitespace-pre-wrap rounded-md bg-notura-surface p-4 text-sm leading-relaxed text-notura-ink font-body">
                  {meeting.summary_whatsapp}
                </pre>
              </AccordionContent>
            </AccordionItem>

            {/* Decisões */}
            <AccordionItem value="decisoes">
              <AccordionTrigger>
                Decisões ({meeting.decisions.length})
              </AccordionTrigger>
              <AccordionContent>
                <ul className="space-y-3">
                  {meeting.decisions.map((d) => (
                    <li
                      key={d.id}
                      className="flex items-start gap-3 rounded-md border border-notura-border p-3"
                    >
                      <CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-notura-green" />
                      <div className="flex-1">
                        <p className="text-sm text-notura-ink">
                          {d.description}
                        </p>
                        <div className="mt-1.5 flex items-center gap-2">
                          {d.decided_by && (
                            <span className="text-xs text-notura-muted">
                              Decidido por {d.decided_by}
                            </span>
                          )}
                          <Badge variant={confidenceVariant(d.confidence)}>
                            {d.confidence === "alta" ? "Alta confiança" : "Média confiança"}
                          </Badge>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </AccordionContent>
            </AccordionItem>

            {/* Tarefas */}
            <AccordionItem value="tarefas">
              <AccordionTrigger>
                Tarefas ({meeting.tasks.length})
              </AccordionTrigger>
              <AccordionContent>
                <ul className="space-y-2">
                  {meeting.tasks.map((task) => {
                    const isChecked = taskStates[task.id] ?? false;
                    return (
                      <li
                        key={task.id}
                        className={cn(
                          "flex items-start gap-3 rounded-md border border-notura-border p-3 transition-colors",
                          isChecked && "bg-notura-surface/50 opacity-70"
                        )}
                      >
                        <Checkbox
                          checked={isChecked}
                          onCheckedChange={() => toggleTask(task.id)}
                          className="mt-0.5"
                        />
                        <div className="min-w-0 flex-1">
                          <p
                            className={cn(
                              "text-sm text-notura-ink",
                              isChecked && "line-through"
                            )}
                          >
                            {task.description}
                          </p>
                          <div className="mt-1.5 flex flex-wrap items-center gap-2">
                            {task.owner && (
                              <div className="flex items-center gap-1.5">
                                <Avatar className="h-5 w-5">
                                  <AvatarFallback
                                    name={task.owner}
                                    className="text-[9px]"
                                  >
                                    {getInitials(task.owner)}
                                  </AvatarFallback>
                                </Avatar>
                                <span className="text-xs text-notura-muted">
                                  {task.owner}
                                </span>
                              </div>
                            )}
                            {task.due_date && (
                              <span className="text-xs text-notura-muted">
                                até {formatDate(task.due_date)}
                              </span>
                            )}
                            <Badge variant={priorityVariant(task.priority)}>
                              {priorityLabel(task.priority)}
                            </Badge>
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </AccordionContent>
            </AccordionItem>

            {/* Em aberto */}
            <AccordionItem value="aberto">
              <AccordionTrigger>
                Em aberto ({meeting.open_items.length})
              </AccordionTrigger>
              <AccordionContent>
                <ul className="space-y-3">
                  {meeting.open_items.map((item) => (
                    <li
                      key={item.id}
                      className="flex items-start gap-3 rounded-md border border-amber-200 bg-amber-50/50 p-3"
                    >
                      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                      <div>
                        <p className="text-sm font-medium text-notura-ink">
                          {item.description}
                        </p>
                        {item.context && (
                          <p className="mt-1 text-xs text-notura-muted">
                            {item.context}
                          </p>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              </AccordionContent>
            </AccordionItem>

            {/* Transcrição */}
            <AccordionItem value="transcricao">
              <AccordionTrigger>Transcrição</AccordionTrigger>
              <AccordionContent>
                <div className="max-h-96 overflow-y-auto rounded-md bg-notura-surface p-4">
                  <pre className="whitespace-pre-wrap font-mono text-xs leading-relaxed text-notura-ink">
                    {meeting.transcript}
                  </pre>
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>

        {/* Right column — 40% */}
        <div className="space-y-4 lg:col-span-2">
          {/* WhatsApp delivery */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <MessageCircle className="h-4 w-4 text-notura-green" />
                Entrega WhatsApp
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-notura-muted">Número</span>
                <span className="font-medium text-notura-ink">
                  {formatPhone(meeting.whatsapp_number)}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-notura-muted">Enviado em</span>
                <span className="text-notura-ink">
                  {meeting.completed_at
                    ? formatDate(meeting.completed_at)
                    : "—"}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-notura-muted">Status</span>
                <Badge
                  variant={
                    meeting.whatsapp_status === "sent"
                      ? "completed"
                      : meeting.whatsapp_status === "failed"
                      ? "failed"
                      : "processing"
                  }
                >
                  {meeting.whatsapp_status === "sent"
                    ? "Enviado"
                    : meeting.whatsapp_status === "failed"
                    ? "Falhou"
                    : "Pendente"}
                </Badge>
              </div>
            </CardContent>
          </Card>

          {/* Details */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Cpu className="h-4 w-4 text-notura-muted" />
                Detalhes
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-notura-muted">Duração do áudio</span>
                <span className="text-notura-ink">
                  {formatDuration(meeting.duration_seconds)}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-notura-muted">Modelo</span>
                <span className="text-notura-ink">Claude 3.5 Sonnet</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-notura-muted">Custo</span>
                <span className="text-notura-ink">
                  US$ {meeting.cost_usd?.toFixed(2) ?? "—"}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-notura-muted">Versão do prompt</span>
                <Badge variant="default">{meeting.prompt_version}</Badge>
              </div>
            </CardContent>
          </Card>

          {/* Pending tasks summary */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <ListTodo className="h-4 w-4 text-notura-muted" />
                Tarefas pendentes
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between text-sm">
                <span className="text-notura-muted">
                  {pendingCount} de {totalTasks} pendentes
                </span>
                <span className="font-medium text-notura-ink">
                  {completionPercent}%
                </span>
              </div>
              <Progress value={completionPercent} className="mt-2" />
            </CardContent>
          </Card>

          {/* Reprocess button */}
          <Button variant="secondary" className="w-full gap-2">
            <RefreshCw className="h-4 w-4" />
            Processar novamente
          </Button>
        </div>
      </div>
    </div>
  );
}
