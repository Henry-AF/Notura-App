"use client";

import React, { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, RefreshCw, Search, Sparkles, X } from "lucide-react";
import { NewMeetingDropdown } from "@/components/dashboard";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState, PageShell } from "@/components/ui/app";
import {
  type MeetingsPageMeeting as Meeting,
  type MeetingsPageStatus as Status,
} from "./meetings-types";

const STATUS_OPTIONS: { value: Status | "all"; label: string }[] = [
  { value: "all", label: "Todos" },
  { value: "completed", label: "Concluido" },
  { value: "processing", label: "Processando" },
  { value: "failed", label: "Falhou" },
];

const WEEKDAY_LABELS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sab"];

function toDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getWeekStart(date: Date): Date {
  const copy = new Date(date);
  const day = copy.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  copy.setDate(copy.getDate() + diff);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function getWeekDays(date: Date): Date[] {
  const start = getWeekStart(date);
  return Array.from({ length: 7 }, (_, idx) => {
    const next = new Date(start);
    next.setDate(start.getDate() + idx);
    return next;
  });
}

function formatHeaderDate(date: Date): string {
  return date.toLocaleDateString("pt-BR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatWeekdayLabel(date: Date): string {
  return WEEKDAY_LABELS[date.getDay()] ?? "";
}

function parseMeetingDateKey(rawDate: string): string | null {
  const parsed = new Date(rawDate);
  if (Number.isNaN(parsed.getTime())) return null;
  return toDateKey(parsed);
}

function buildParticipantSeeds(meeting: Meeting): string[] {
  const seeds = [meeting.clientName];
  const words = meeting.title.split(" ").filter(Boolean);
  for (const word of words) {
    if (seeds.length >= 3) break;
    if (!seeds.includes(word)) seeds.push(word);
  }
  return seeds.slice(0, 3);
}

function MeetingCard({
  meeting,
  onRetry,
  onViewProcessing,
  onOpen,
}: {
  meeting: Meeting;
  onRetry: (id: string) => void;
  onViewProcessing: (id: string) => void;
  onOpen: (id: string) => void;
}) {
  const isActive = meeting.status === "processing";
  const participantSeeds = buildParticipantSeeds(meeting);
  const actionButton = (
    <div
      className="flex shrink-0 items-center justify-end"
      onClick={(event) => event.stopPropagation()}
    >
      {meeting.status === "processing" ? (
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="h-8 w-8 rounded-md p-0 text-primary"
          onClick={() => onViewProcessing(meeting.id)}
          aria-label="Ver processamento"
        >
          <Sparkles className="h-4 w-4" />
        </Button>
      ) : null}
      {meeting.status === "failed" ? (
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="h-8 w-8 rounded-md p-0 text-destructive"
          onClick={() => onRetry(meeting.id)}
          aria-label="Reprocessar reunião"
        >
          <RefreshCw className="h-4 w-4" />
        </Button>
      ) : null}
    </div>
  );

  return (
    <article
      role="button"
      tabIndex={0}
      onClick={() => onOpen(meeting.id)}
      onKeyDown={(event) => {
        if (event.key === "Enter") onOpen(meeting.id);
      }}
      className="group relative flex cursor-pointer gap-4"
    >
      <div
        className={
          isActive
            ? "absolute left-3 top-6 h-4 w-4 -translate-x-1/2 rounded-full bg-primary"
            : "absolute left-3 top-6 h-3 w-3 -translate-x-1/2 rounded-full border-2 border-primary bg-background"
        }
      />
      <div
        className={
          isActive
            ? "w-full rounded-2xl bg-primary px-4 py-4 text-primary-foreground shadow-none"
            : "w-full rounded-2xl bg-white px-4 py-4 text-foreground shadow-[0_2px_8px_rgba(0,0,0,0.06)]"
        }
      >
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p
              className={
                isActive
                  ? "truncate text-sm font-semibold text-primary-foreground"
                  : "truncate text-sm font-semibold text-foreground"
              }
            >
              {meeting.clientName}
            </p>
            <p
              className={
                isActive
                  ? "truncate text-xs text-primary-foreground/80"
                  : "truncate text-xs text-muted-foreground"
              }
            >
              {meeting.title}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span
              className={
                isActive
                  ? "text-[11px] font-medium text-primary-foreground/90"
                  : "text-[11px] font-medium text-muted-foreground"
              }
            >
              {meeting.date}
            </span>
            {actionButton}
          </div>
        </div>

        {isActive ? (
          <div className="mt-4 flex items-center justify-between">
            <div className="flex -space-x-2">
              {participantSeeds.map((seed) => (
                <Avatar key={seed} className="h-8 w-8 border-2 border-primary">
                  <AvatarFallback name={seed} className="text-[11px] font-semibold" />
                </Avatar>
              ))}
            </div>
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20">
              <Sparkles className="h-4 w-4 text-white" />
            </div>
          </div>
        ) : null}
      </div>
    </article>
  );
}

export interface MeetingsClientProps {
  initialMeetings: Meeting[];
}

export function MeetingsClient({ initialMeetings }: MeetingsClientProps) {
  const router = useRouter();
  const [meetings, setMeetings] = useState<Meeting[]>(initialMeetings);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<Status | "all">("all");
  const [selectedDayKey, setSelectedDayKey] = useState(() => toDateKey(new Date()));
  const weekDays = useMemo(() => getWeekDays(new Date()), []);

  const handleRetry = useCallback(async (id: string) => {
    try {
      const response = await fetch(`/api/meetings/${id}/retry`, { method: "POST" });
      if (!response.ok) throw new Error("retry failed");

      setMeetings((previous) =>
        previous.map((meeting) =>
          meeting.id === id ? { ...meeting, status: "processing" as const } : meeting
        )
      );
    } catch {
      // silently ignore for now; page-level toast will be added in a later pass
    }
  }, []);

  const filtered = useMemo(() => {
    const query = search.toLowerCase();

    return meetings.filter((meeting) => {
      const meetingKey = parseMeetingDateKey(meeting.rawDate);
      const matchesDay = meetingKey ? meetingKey === selectedDayKey : true;
      const matchesQuery =
        !query ||
        meeting.clientName.toLowerCase().includes(query) ||
        meeting.title.toLowerCase().includes(query) ||
        meeting.date.toLowerCase().includes(query);
      const matchesStatus = statusFilter === "all" || meeting.status === statusFilter;

      return matchesDay && matchesQuery && matchesStatus;
    });
  }, [meetings, search, selectedDayKey, statusFilter]);

  const headerDate = formatHeaderDate(new Date());

  return (
    <PageShell
      className="min-h-screen bg-[#F4F5F8]"
      contentClassName="px-5 pb-24 pt-6 sm:px-6 lg:px-8"
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-[13px] font-normal text-muted-foreground">
            {headerDate}
          </p>
          <h1 className="text-3xl font-extrabold text-foreground">Hoje</h1>
        </div>
        <NewMeetingDropdown
          onNewMeeting={() => router.push("/dashboard/recording")}
          onUpload={() => router.push("/dashboard/new")}
        />
      </div>

      <div className="flex items-center justify-between gap-2">
        {weekDays.map((day) => {
          const dayKey = toDateKey(day);
          const isSelected = dayKey === selectedDayKey;
          return (
            <button
              key={dayKey}
              type="button"
              onClick={() => setSelectedDayKey(dayKey)}
              className="flex flex-1 flex-col items-center gap-1 rounded-xl px-1 py-2 transition-colors"
            >
              <span
                className={
                  isSelected
                    ? "text-[11px] font-medium text-primary"
                    : "text-[11px] font-medium text-muted-foreground"
                }
              >
                {formatWeekdayLabel(day)}
              </span>
              <span
                className={
                  isSelected
                    ? "text-[15px] font-semibold text-primary"
                    : "text-[15px] font-medium text-muted-foreground"
                }
              >
                {day.getDate()}
              </span>
              <span
                className={
                  isSelected
                    ? "h-1.5 w-1.5 rounded-full bg-primary"
                    : "h-1.5 w-1.5 rounded-full bg-transparent"
                }
              />
            </button>
          );
        })}
      </div>

      <div className="flex flex-col gap-3 rounded-2xl bg-white/70 p-3 shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Buscar por cliente ou título..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="h-10 rounded-xl bg-white pl-9 pr-9"
          />
          {search ? (
            <button
              type="button"
              onClick={() => setSearch("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
              aria-label="Limpar busca"
            >
              <X className="h-4 w-4" />
            </button>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2">
          {STATUS_OPTIONS.map((option) => (
            <Button
              key={option.value}
              type="button"
              size="sm"
              variant={statusFilter === option.value ? "default" : "outline"}
              className="rounded-full px-4"
              onClick={() => setStatusFilter(option.value)}
            >
              {option.label}
            </Button>
          ))}
        </div>
      </div>

      <div className="relative space-y-3 pl-6">
        <div className="absolute left-3 top-0 h-full w-0.5 bg-primary/80" />

        {filtered.length === 0 ? (
          <EmptyState
            className="min-h-[180px] border-0 bg-transparent"
            title="Nenhuma reunião encontrada"
            description={
              search || statusFilter !== "all"
                ? "Tente ajustar os filtros para encontrar reuniões."
                : "Você ainda não possui reuniões nesta conta."
            }
          />
        ) : null}

        {filtered.map((meeting) => (
          <MeetingCard
            key={meeting.id}
            meeting={meeting}
            onRetry={handleRetry}
            onViewProcessing={(id) => router.push(`/dashboard/meetings/${id}`)}
            onOpen={(id) => router.push(`/dashboard/meetings/${id}`)}
          />
        ))}
      </div>

      <button
        type="button"
        aria-label="Criar nova reunião"
        title="Criar nova reunião"
        onClick={() => router.push("/dashboard/recording")}
        className="fixed bottom-6 left-1/2 z-40 flex h-14 w-14 -translate-x-1/2 items-center justify-center rounded-[18px] bg-primary text-primary-foreground shadow-[0_4px_16px_rgba(59,130,246,0.35)] transition-transform active:scale-95"
      >
        <Plus className="h-6 w-6" />
      </button>
    </PageShell>
  );
}
