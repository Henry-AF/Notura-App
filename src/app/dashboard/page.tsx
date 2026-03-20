"use client";

import React from "react";
import Link from "next/link";
import {
  Calendar,
  CheckSquare,
  Clock,
  MessageCircle,
  Plus,
  ArrowRight,
  FileAudio,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn, formatRelativeTime, formatDuration } from "@/lib/utils";
import type { Meeting, MeetingStatus, DashboardStats } from "@/types/database";

// ─── Mock Data ──────────────────────────────────────────────────────────────

const mockStats: DashboardStats = {
  meetings_this_month: 12,
  tasks_generated: 34,
  hours_saved: 4,
  whatsapp_connected: true,
};

const mockMeetings: (Meeting & { task_count: number })[] = [
  {
    id: "m1",
    user_id: "u1",
    title: "Alinhamento trimestral — Equipe RH",
    client_name: "Interno",
    meeting_date: "2026-03-19",
    audio_r2_key: null,
    transcript: null,
    summary_whatsapp: null,
    summary_json: null,
    whatsapp_number: "5511999887766",
    whatsapp_status: "sent",
    status: "completed",
    source: "upload",
    duration_seconds: 2700,
    cost_usd: 0.12,
    prompt_version: "v3.0",
    error_message: null,
    created_at: new Date(Date.now() - 2 * 3600000).toISOString(),
    completed_at: new Date(Date.now() - 1.5 * 3600000).toISOString(),
    task_count: 5,
  },
  {
    id: "m2",
    user_id: "u1",
    title: "Revisão contrato — Fernanda Vieira Advocacia",
    client_name: "Fernanda Vieira",
    meeting_date: "2026-03-18",
    audio_r2_key: null,
    transcript: null,
    summary_whatsapp: null,
    summary_json: null,
    whatsapp_number: "5511988776655",
    whatsapp_status: "sent",
    status: "completed",
    source: "upload",
    duration_seconds: 1800,
    cost_usd: 0.08,
    prompt_version: "v3.0",
    error_message: null,
    created_at: new Date(Date.now() - 26 * 3600000).toISOString(),
    completed_at: new Date(Date.now() - 25 * 3600000).toISOString(),
    task_count: 3,
  },
  {
    id: "m3",
    user_id: "u1",
    title: "Sprint planning — Projeto Nova Plataforma",
    client_name: "Equipe Dev",
    meeting_date: "2026-03-17",
    audio_r2_key: null,
    transcript: null,
    summary_whatsapp: null,
    summary_json: null,
    whatsapp_number: "5511977665544",
    whatsapp_status: "sent",
    status: "completed",
    source: "chrome_extension",
    duration_seconds: 3600,
    cost_usd: 0.15,
    prompt_version: "v3.0",
    error_message: null,
    created_at: new Date(Date.now() - 50 * 3600000).toISOString(),
    completed_at: new Date(Date.now() - 49 * 3600000).toISOString(),
    task_count: 8,
  },
  {
    id: "m4",
    user_id: "u1",
    title: "Entrevista candidata — Ana Paula Costa",
    client_name: null,
    meeting_date: "2026-03-16",
    audio_r2_key: null,
    transcript: null,
    summary_whatsapp: null,
    summary_json: null,
    whatsapp_number: "5511999887766",
    whatsapp_status: "failed",
    status: "completed",
    source: "upload",
    duration_seconds: 2100,
    cost_usd: 0.09,
    prompt_version: "v3.0",
    error_message: null,
    created_at: new Date(Date.now() - 74 * 3600000).toISOString(),
    completed_at: new Date(Date.now() - 73 * 3600000).toISOString(),
    task_count: 2,
  },
  {
    id: "m5",
    user_id: "u1",
    title: "Reunião semanal — Diretoria",
    client_name: "Diretoria",
    meeting_date: "2026-03-15",
    audio_r2_key: null,
    transcript: null,
    summary_whatsapp: null,
    summary_json: null,
    whatsapp_number: "5511999887766",
    whatsapp_status: "pending",
    status: "processing",
    source: "upload",
    duration_seconds: null,
    cost_usd: null,
    prompt_version: null,
    error_message: null,
    created_at: new Date(Date.now() - 0.5 * 3600000).toISOString(),
    completed_at: null,
    task_count: 0,
  },
];

// ─── Status badge mapping ──────────────────────────────────────────────────

function statusLabel(status: MeetingStatus): string {
  const map: Record<MeetingStatus, string> = {
    pending: "Pendente",
    processing: "Processando",
    completed: "Concluída",
    failed: "Erro",
  };
  return map[status];
}

function statusVariant(
  status: MeetingStatus
): "default" | "processing" | "completed" | "failed" {
  const map: Record<MeetingStatus, "default" | "processing" | "completed" | "failed"> = {
    pending: "default",
    processing: "processing",
    completed: "completed",
    failed: "failed",
  };
  return map[status];
}

// ─── Metric Card ────────────────────────────────────────────────────────────

function MetricCard({
  icon: Icon,
  label,
  value,
  accent,
}: {
  icon: React.ElementType;
  label: string;
  value: React.ReactNode;
  accent?: boolean;
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4 p-5">
        <div
          className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg",
            accent
              ? "bg-notura-green-light text-notura-green"
              : "bg-notura-surface text-notura-muted"
          )}
        >
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className="text-xs text-notura-muted">{label}</p>
          <p className="mt-0.5 font-display text-xl font-semibold text-notura-ink">
            {value}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Empty State ────────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <Card className="mt-6">
      <CardContent className="flex flex-col items-center justify-center py-16 text-center">
        {/* CSS illustration */}
        <div className="relative mb-6">
          <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-notura-green-light">
            <FileAudio className="h-10 w-10 text-notura-green" />
          </div>
          <div className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full bg-notura-green text-white shadow-subtle">
            <Plus className="h-4 w-4" />
          </div>
        </div>
        <h3 className="font-display text-lg font-semibold text-notura-ink">
          Sua primeira reunião está a um clique
        </h3>
        <p className="mt-2 max-w-sm text-sm text-notura-muted">
          Faça upload de um áudio ou conecte seu Google Meet para começar a
          receber resumos automáticos no WhatsApp.
        </p>
        <Button asChild className="mt-6 gap-2">
          <Link href="/dashboard/new">
            <Plus className="h-4 w-4" />
            Nova Reunião
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  // Toggle this to false to see empty state
  const hasMeetings = mockMeetings.length > 0;

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold text-notura-ink">
            Dashboard
          </h1>
          <p className="mt-1 text-sm text-notura-muted">
            Visão geral das suas reuniões e tarefas
          </p>
        </div>
        <Button asChild className="gap-2">
          <Link href="/dashboard/new">
            <Plus className="h-4 w-4" />
            Nova Reunião
          </Link>
        </Button>
      </div>

      {/* Metric cards */}
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          icon={Calendar}
          label="Reuniões este mês"
          value={mockStats.meetings_this_month}
          accent
        />
        <MetricCard
          icon={CheckSquare}
          label="Tarefas geradas"
          value={mockStats.tasks_generated}
        />
        <MetricCard
          icon={Clock}
          label="Horas economizadas"
          value={`${mockStats.hours_saved}h`}
        />
        <MetricCard
          icon={MessageCircle}
          label="WhatsApp"
          value={
            mockStats.whatsapp_connected ? (
              <Badge variant="completed">Conectado</Badge>
            ) : (
              <Badge variant="default">Desconectado</Badge>
            )
          }
        />
      </div>

      {/* Meetings list or empty state */}
      {hasMeetings ? (
        <div className="mt-8">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg font-semibold text-notura-ink">
              Reuniões recentes
            </h2>
            <Link
              href="/dashboard"
              className="flex items-center gap-1 text-sm font-medium text-notura-green hover:text-notura-green-dark"
            >
              Ver todas
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          <div className="mt-4 space-y-2">
            {mockMeetings.map((meeting) => (
              <Link key={meeting.id} href={`/dashboard/meetings/${meeting.id}`}>
                <Card className="transition-shadow hover:shadow-card">
                  <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                    {/* Left: title + meta */}
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-notura-ink">
                        {meeting.title}
                      </p>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-notura-muted">
                        <span>{formatRelativeTime(meeting.created_at)}</span>
                        {meeting.duration_seconds && (
                          <>
                            <span className="text-notura-border">·</span>
                            <span>
                              {formatDuration(meeting.duration_seconds)}
                            </span>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Right: badges */}
                    <div className="flex shrink-0 items-center gap-2">
                      {meeting.task_count > 0 && (
                        <Badge variant="default">
                          {meeting.task_count}{" "}
                          {meeting.task_count === 1 ? "tarefa" : "tarefas"}
                        </Badge>
                      )}
                      <Badge variant={statusVariant(meeting.status)}>
                        {statusLabel(meeting.status)}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      ) : (
        <EmptyState />
      )}
    </div>
  );
}
