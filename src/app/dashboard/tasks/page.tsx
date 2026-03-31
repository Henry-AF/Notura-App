"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import { CheckCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn, formatDate, getInitials } from "@/lib/utils";
import type { Task, Priority } from "@/types/database";

// ─── Mock Data ──────────────────────────────────────────────────────────────

interface TaskWithMeeting extends Task {
  meeting_title: string;
}

const mockTasks: TaskWithMeeting[] = [
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
    meeting_title: "Alinhamento trimestral — Equipe RH",
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
    meeting_title: "Alinhamento trimestral — Equipe RH",
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
    meeting_title: "Alinhamento trimestral — Equipe RH",
  },
  {
    id: "t4",
    meeting_id: "m2",
    user_id: "u1",
    description: "Revisar cláusula de confidencialidade do contrato",
    owner: "Fernanda",
    due_date: "2026-03-18",
    priority: "alta",
    completed: false,
    completed_at: null,
    created_at: "2026-03-18T10:00:00.000Z",
    meeting_title: "Revisão contrato — Fernanda Vieira Advocacia",
  },
  {
    id: "t5",
    meeting_id: "m2",
    user_id: "u1",
    description: "Enviar versão final do contrato para assinatura",
    owner: "Henry",
    due_date: "2026-03-22",
    priority: "alta",
    completed: false,
    completed_at: null,
    created_at: "2026-03-18T10:00:00.000Z",
    meeting_title: "Revisão contrato — Fernanda Vieira Advocacia",
  },
  {
    id: "t6",
    meeting_id: "m2",
    user_id: "u1",
    description: "Verificar CNPJ do fornecedor no portal da Receita",
    owner: "Fernanda",
    due_date: "2026-03-19",
    priority: "média",
    completed: true,
    completed_at: "2026-03-19T09:00:00.000Z",
    created_at: "2026-03-18T10:00:00.000Z",
    meeting_title: "Revisão contrato — Fernanda Vieira Advocacia",
  },
  {
    id: "t7",
    meeting_id: "m3",
    user_id: "u1",
    description: "Configurar ambiente de staging para o deploy",
    owner: "Ricardo",
    due_date: "2026-03-20",
    priority: "alta",
    completed: false,
    completed_at: null,
    created_at: "2026-03-17T15:00:00.000Z",
    meeting_title: "Sprint planning — Projeto Nova Plataforma",
  },
  {
    id: "t8",
    meeting_id: "m3",
    user_id: "u1",
    description: "Criar documentação da API de integração",
    owner: "Ana Paula",
    due_date: "2026-03-28",
    priority: "média",
    completed: false,
    completed_at: null,
    created_at: "2026-03-17T15:00:00.000Z",
    meeting_title: "Sprint planning — Projeto Nova Plataforma",
  },
  {
    id: "t9",
    meeting_id: "m3",
    user_id: "u1",
    description: "Alinhar design do dashboard com equipe de produto",
    owner: "Marcos",
    due_date: "2026-03-24",
    priority: "média",
    completed: false,
    completed_at: null,
    created_at: "2026-03-17T15:00:00.000Z",
    meeting_title: "Sprint planning — Projeto Nova Plataforma",
  },
  {
    id: "t10",
    meeting_id: "m4",
    user_id: "u1",
    description: "Enviar proposta salarial para candidata aprovada",
    owner: "Henry",
    due_date: "2026-03-20",
    priority: "alta",
    completed: false,
    completed_at: null,
    created_at: "2026-03-16T11:00:00.000Z",
    meeting_title: "Entrevista candidata — Ana Paula Costa",
  },
];

// ─── Helpers ────────────────────────────────────────────────────────────────

type StatusFilter = "todas" | "pendentes" | "concluidas";

function priorityVariant(p: Priority) {
  if (p === "alta") return "priority-alta" as const;
  if (p === "média") return "priority-media" as const;
  return "priority-baixa" as const;
}

function priorityLabel(p: Priority) {
  if (p === "alta") return "Alta";
  if (p === "média") return "Média";
  return "Baixa";
}

function dueDateColor(dueDate: string | null): string {
  if (!dueDate) return "text-notura-secondary";
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(dueDate);
  due.setHours(0, 0, 0, 0);
  const diff = due.getTime() - today.getTime();
  const daysDiff = diff / (1000 * 60 * 60 * 24);

  if (daysDiff < 0) return "text-red-600 font-medium";
  if (daysDiff === 0) return "text-amber-600 font-medium";
  return "text-notura-secondary";
}

function dueDateLabel(dueDate: string | null): string {
  if (!dueDate) return "Sem prazo";
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(dueDate);
  due.setHours(0, 0, 0, 0);
  const diff = due.getTime() - today.getTime();
  const daysDiff = Math.round(diff / (1000 * 60 * 60 * 24));

  if (daysDiff < 0) return `Vencida (${formatDate(dueDate)})`;
  if (daysDiff === 0) return "Hoje";
  if (daysDiff === 1) return "Amanhã";
  return formatDate(dueDate);
}

// ─── Empty State ────────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <Card className="mt-6">
      <CardContent className="flex flex-col items-center justify-center py-16 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-violet-100">
          <CheckCircle className="h-8 w-8 text-violet-600" />
        </div>
        <h3 className="mt-4 font-display text-lg font-semibold text-notura-ink">
          Nenhuma tarefa pendente — você está em dia
        </h3>
        <p className="mt-2 max-w-sm text-sm text-notura-secondary">
          As tarefas extraídas das suas reuniões aparecerão aqui
          automaticamente.
        </p>
      </CardContent>
    </Card>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function TasksPage() {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("todas");
  const [meetingFilter, setMeetingFilter] = useState<string>("all");
  const [ownerFilter, setOwnerFilter] = useState<string>("all");
  const [taskStates, setTaskStates] = useState<Record<string, boolean>>(
    Object.fromEntries(mockTasks.map((t) => [t.id, t.completed]))
  );

  // Derive unique meetings + owners for filters
  const meetings = useMemo(() => {
    const unique = new Map<string, string>();
    mockTasks.forEach((t) => unique.set(t.meeting_id, t.meeting_title));
    return Array.from(unique.entries());
  }, []);

  const owners = useMemo(() => {
    const unique = new Set<string>();
    mockTasks.forEach((t) => {
      if (t.owner) unique.add(t.owner);
    });
    return Array.from(unique).sort();
  }, []);

  // Filter + sort
  const filteredTasks = useMemo(() => {
    let tasks = mockTasks.map((t) => ({
      ...t,
      completed: taskStates[t.id] ?? t.completed,
    }));

    if (statusFilter === "pendentes") {
      tasks = tasks.filter((t) => !t.completed);
    } else if (statusFilter === "concluidas") {
      tasks = tasks.filter((t) => t.completed);
    }

    if (meetingFilter !== "all") {
      tasks = tasks.filter((t) => t.meeting_id === meetingFilter);
    }

    if (ownerFilter !== "all") {
      tasks = tasks.filter((t) => t.owner === ownerFilter);
    }

    // Sort: pending first, then by created_at desc
    tasks.sort((a, b) => {
      if (a.completed !== b.completed) return a.completed ? 1 : -1;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

    return tasks;
  }, [statusFilter, meetingFilter, ownerFilter, taskStates]);

  const toggleTask = (taskId: string) => {
    setTaskStates((prev) => ({ ...prev, [taskId]: !prev[taskId] }));
  };

  return (
    <div>
      {/* Header */}
      <div>
        <h1 className="font-display text-2xl font-bold text-notura-ink">
          Tarefas
        </h1>
        <p className="mt-1 text-sm text-notura-secondary">
          Todas as tarefas extraídas das suas reuniões
        </p>
      </div>

      {/* Filter bar */}
      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
        {/* Status filter — button group */}
        <div className="flex rounded-lg border border-notura-border bg-white">
          {(
            [
              { key: "todas", label: "Todas" },
              { key: "pendentes", label: "Pendentes" },
              { key: "concluidas", label: "Concluídas" },
            ] as const
          ).map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setStatusFilter(key)}
              className={cn(
                "px-3 py-1.5 text-sm font-medium transition-all first:rounded-l-lg last:rounded-r-lg",
                statusFilter === key
                  ? "bg-notura-primary text-white"
                  : "text-notura-secondary hover:bg-gray-50 hover:text-notura-ink"
              )}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Meeting filter */}
        <Select value={meetingFilter} onValueChange={setMeetingFilter}>
          <SelectTrigger className="w-full sm:w-52">
            <SelectValue placeholder="Todas as reuniões" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as reuniões</SelectItem>
            {meetings.map(([id, title]) => (
              <SelectItem key={id} value={id}>
                {title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Owner filter */}
        <Select value={ownerFilter} onValueChange={setOwnerFilter}>
          <SelectTrigger className="w-full sm:w-44">
            <SelectValue placeholder="Todos os responsáveis" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            {owners.map((owner) => (
              <SelectItem key={owner} value={owner}>
                {owner}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Task list */}
      {filteredTasks.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="mt-4 space-y-2">
          {filteredTasks.map((task) => {
            const isChecked = task.completed;
            return (
              <Card
                key={task.id}
                className={cn(
                  "transition-all",
                  isChecked && "opacity-60"
                )}
              >
                <CardContent className="flex items-start gap-3 p-4">
                  <Checkbox
                    checked={isChecked}
                    onCheckedChange={() => toggleTask(task.id)}
                    className="mt-0.5"
                  />
                  <div className="min-w-0 flex-1">
                    <p
                      className={cn(
                        "text-sm text-notura-ink",
                        isChecked && "line-through text-notura-secondary"
                      )}
                    >
                      {task.description}
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <Link
                        href={`/dashboard/meetings/${task.meeting_id}`}
                        className="text-xs text-notura-primary hover:underline"
                      >
                        {task.meeting_title}
                      </Link>
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
                          <span className="text-xs text-notura-secondary">
                            {task.owner}
                          </span>
                        </div>
                      )}
                      <span
                        className={cn("text-xs", dueDateColor(task.due_date))}
                      >
                        {dueDateLabel(task.due_date)}
                      </span>
                      <Badge variant={priorityVariant(task.priority as Priority)}>
                        {priorityLabel(task.priority as Priority)}
                      </Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
