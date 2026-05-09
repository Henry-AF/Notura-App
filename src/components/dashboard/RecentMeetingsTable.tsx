"use client";

import React, { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Plus, RefreshCw, Sparkles, Trash2 } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { EmptyState } from "@/components/ui/app";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Meeting {
  id: string;
  clientName: string;
  title: string;
  date: string;
  createdAt: string;
  status: "completed" | "processing" | "failed";
}

interface CalendarMeeting {
  id: string;
  title: string | null;
  clientName: string | null;
  createdAt: string;
  status: "completed" | "processing" | "failed" | string;
}

// ─── Avatar ───────────────────────────────────────────────────────────────────

const AVATAR_COLORS: Record<string, { bg: string; color: string }> = {
  A: { bg: "rgba(116,192,252,0.15)", color: "#4A8FD9" },
  N: { bg: "rgba(162,155,254,0.15)", color: "#6C5CE7" },
  H: { bg: "rgba(255,138,138,0.15)", color: "#D94444" },
};

const VIEW_MODES = ["day", "week", "month", "year"] as const;
type ViewMode = (typeof VIEW_MODES)[number];


function getAvatarStyle(name: string): { bg: string; color: string } {
  const initial = name.trim()[0]?.toUpperCase() ?? "?";
  if (AVATAR_COLORS[initial]) return AVATAR_COLORS[initial];
  // Hash fallback — semi-transparent so it works in both light and dark
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  const hue = Math.abs(hash) % 360;
  return { bg: `hsla(${hue},60%,55%,0.15)`, color: `hsl(${hue},55%,42%)` };
}

function toDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatHeaderDate(date: Date): string {
  return date.toLocaleDateString("pt-BR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatMonthLabel(date: Date): string {
  return date.toLocaleDateString("pt-BR", {
    month: "long",
    year: "numeric",
  });
}

function formatYearLabel(date: Date): string {
  return date.toLocaleDateString("pt-BR", { year: "numeric" });
}

function addMonths(date: Date, delta: number): Date {
  const next = new Date(date);
  next.setMonth(next.getMonth() + delta);
  return next;
}

function addWeeks(date: Date, delta: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + delta * 7);
  return next;
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

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function toLocalDate(value: string): Date | null {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

function parseMeetingDateKey(rawDate: string): string | null {
  const parsed = toLocalDate(rawDate);
  if (!parsed) return null;
  return toDateKey(parsed);
}

function formatMeetingTime(rawDate: string): string | null {
  const parsed = toLocalDate(rawDate);
  if (!parsed) return null;
  return parsed.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatRelativeLabel(rawDate: string): string | null {
  const parsed = toLocalDate(rawDate);
  if (!parsed) return null;
  const now = new Date();
  const diffMs = parsed.getTime() - now.getTime();
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
  const diffHours = Math.round(diffMs / (1000 * 60 * 60));
  if (diffDays === 0) {
    if (Math.abs(diffHours) <= 1) return "Agora";
    if (diffHours > 0) return `Em ${diffHours} horas`;
    return `Há ${Math.abs(diffHours)} horas`;
  }
  if (diffDays === 1) return "Amanhã";
  if (diffDays === -1) return "Ontem";
  if (diffDays > 1) return `Em ${diffDays} dias`;
  return `Há ${Math.abs(diffDays)} dias`;
}


// ─── Status badge ─────────────────────────────────────────────────────────────

const STATUS_MAP = {
  completed: { dot: "#4ECB71", label: "Concluído", bg: "rgba(78,203,113,0.1)", color: "#4ECB71" },
  processing: { dot: "#74C0FC", label: "Processando", bg: "rgba(116,192,252,0.1)", color: "#74C0FC" },
  failed: { dot: "#FF6B6B", label: "Falhou", bg: "rgba(255,107,107,0.1)", color: "#FF6B6B" },
} as const;

function normalizeMeetingStatus(status: string): Meeting["status"] {
  if (status === "completed") return "completed";
  if (status === "failed") return "failed";
  return "processing";
}

function StatusBadge({ status }: { status: Meeting["status"] }) {
  const s = STATUS_MAP[status];
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-semibold sm:px-3 sm:py-1.5 sm:text-[13px]"
      style={{
        background: s.bg,
        color: s.color,
        whiteSpace: "nowrap",
      }}
    >
      <span
        style={{ width: 6, height: 6, borderRadius: "50%", background: s.dot, flexShrink: 0 }}
      />
      {s.label}
    </span>
  );
}

// ─── MeetingRow ───────────────────────────────────────────────────────────────

interface MeetingRowProps {
  meeting: Meeting;
  onRetry: (id: string) => void;
  onViewProcessing: (id: string) => void;
  onClick: (id: string) => void;
}

export function MeetingRow({ meeting, onRetry, onViewProcessing, onClick }: MeetingRowProps) {
  const avatarStyle = getAvatarStyle(meeting.clientName);
  const initial = meeting.clientName.trim()[0]?.toUpperCase() ?? "?";

  const actionButton = (
    <div
      className="flex shrink-0 items-center justify-end"
      onClick={(e) => e.stopPropagation()}
    >
      {meeting.status === "processing" && (
        <button
          type="button"
          title="Ver processo"
          onClick={() => onViewProcessing(meeting.id)}
          className="flex h-[30px] w-[30px] items-center justify-center rounded-lg transition-colors hover:opacity-80"
          style={{ background: "rgb(var(--cn-card2))", color: "#A29BFE" }}
        >
          <Sparkles style={{ width: 14, height: 14 }} />
        </button>
      )}
      {meeting.status === "failed" && (
        <button
          type="button"
          title="Reprocessar"
          onClick={() => onRetry(meeting.id)}
          className="flex h-[30px] w-[30px] items-center justify-center rounded-lg transition-colors hover:opacity-80"
          style={{ background: "rgba(255,107,107,0.1)", color: "#FF6B6B" }}
        >
          <RefreshCw style={{ width: 14, height: 14 }} />
        </button>
      )}
    </div>
  );

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onClick(meeting.id)}
      onKeyDown={(e) => e.key === "Enter" && onClick(meeting.id)}
      className="flex cursor-pointer items-center gap-3 rounded-xl px-3 py-3.5 transition-colors hover:bg-[rgb(var(--cn-card2))] sm:grid sm:grid-cols-[1fr_120px_140px_60px] sm:gap-2 sm:py-3"
    >
      {/* ── Mobile-only standalone avatar ──────────────────────────────── */}
      <div
        className="flex shrink-0 items-center justify-center sm:hidden"
        style={{
          width: 38,
          height: 38,
          borderRadius: "50%",
          background: avatarStyle.bg,
          color: avatarStyle.color,
          fontSize: "13px",
          fontWeight: 700,
        }}
      >
        {initial}
      </div>

      {/* ── Column 1: client + title ────────────────────────────────────── */}
      <div className="min-w-0 flex-1 sm:flex sm:items-center sm:gap-3">
        {/* Desktop avatar (inside column 1) */}
        <div
          className="hidden shrink-0 sm:flex"
          style={{
            width: 34,
            height: 34,
            borderRadius: "50%",
            background: avatarStyle.bg,
            color: avatarStyle.color,
            alignItems: "center",
            justifyContent: "center",
            fontSize: "13px",
            fontWeight: 700,
          }}
        >
          {initial}
        </div>

        <div className="min-w-0 flex-1">
          <p style={{ fontWeight: 600, fontSize: "14px", color: "rgb(var(--cn-ink))" }}>
            {meeting.clientName}
          </p>
          <p
            className="truncate"
            style={{ fontSize: "12px", color: "rgb(var(--cn-muted))", maxWidth: "220px" }}
          >
            {meeting.title}
          </p>
        </div>

        {/* Mobile-only: date + status below the name */}
        <div className="mt-1.5 flex flex-wrap items-center gap-2 sm:hidden">
          <span style={{ fontSize: "11px", color: "rgb(var(--cn-ink3))" }}>
            {meeting.date}
          </span>
          <StatusBadge status={meeting.status} />
        </div>
      </div>

      {/* ── Column 2: date (desktop only) ──────────────────────────────── */}
      <p
        className="hidden sm:block"
        style={{ fontSize: "13px", color: "rgb(var(--cn-ink2))" }}
      >
        {meeting.date}
      </p>

      {/* ── Column 3: status (desktop only) ────────────────────────────── */}
      <div className="hidden sm:block">
        <StatusBadge status={meeting.status} />
      </div>

      {/* ── Column 4: actions ──────────────────────────────────────────── */}
      {actionButton}
    </div>
  );
}

// ─── RecentMeetingsTable ─────────────────────────────────────────────────────

export interface RecentMeetingsTableProps {
  meetings: Meeting[];
  onViewAll: () => void;
  onRetry: (id: string) => void;
  onViewProcessing: (id: string) => void;
  onRowClick: (id: string) => void;
  onNewMeeting: () => void;
}

export function RecentMeetingsTable({
  meetings,
  onViewAll: _onViewAll,
  onRetry,
  onViewProcessing,
  onRowClick,
  onNewMeeting,
}: RecentMeetingsTableProps) {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [currentMonth, setCurrentMonth] = useState<Date>(new Date());
  const [viewMode, setViewMode] = useState<ViewMode>("month");
  const [calendarMeetings, setCalendarMeetings] = useState<CalendarMeeting[]>([]);
  const [calendarStatus, setCalendarStatus] = useState<"loading" | "ready" | "error">(
    "loading"
  );
  const [calendarError, setCalendarError] = useState<string | null>(null);
  const [showAllMeetings, setShowAllMeetings] = useState(false);
  const calendarAnchorRef = React.useRef<HTMLDivElement>(null);

  const headerDate = formatHeaderDate(new Date());
  const selectedDateKey = useMemo(() => toDateKey(selectedDate), [selectedDate]);

  useEffect(() => {
    let active = true;

    async function loadMeetings() {
      setCalendarStatus("loading");
      setCalendarError(null);
      try {
        const response = await fetch("/api/meetings");
        const body = (await response.json()) as { meetings?: CalendarMeeting[]; error?: string };
        if (!response.ok) {
          throw new Error(body?.error ?? "Erro ao carregar reuniões.");
        }
        const items = Array.isArray(body?.meetings) ? body.meetings : [];
        if (!active) return;
        setCalendarMeetings(
          items.map((meeting) => ({
            id: meeting.id,
            title: meeting.title ?? null,
            clientName: meeting.clientName ?? null,
            createdAt: meeting.createdAt,
            status: meeting.status,
          }))
        );
        setCalendarStatus("ready");
      } catch (error) {
        if (!active) return;
        setCalendarStatus("error");
        setCalendarError(error instanceof Error ? error.message : "Erro ao carregar reuniões.");
      }
    }

    loadMeetings();
    return () => {
      active = false;
    };
  }, []);

  const meetingsByDate = useMemo(() => {
    const map = new Map<string, CalendarMeeting[]>();
    calendarMeetings.forEach((meeting) => {
      const key = parseMeetingDateKey(meeting.createdAt);
      if (!key) return;
      const list = map.get(key);
      if (list) {
        list.push(meeting);
      } else {
        map.set(key, [meeting]);
      }
    });
    return map;
  }, [calendarMeetings]);

  const meetingDates = useMemo(() => {
    return Array.from(meetingsByDate.keys()).map((key) => {
      const [year, month, day] = key.split("-").map(Number);
      return new Date(year, month - 1, day);
    });
  }, [meetingsByDate]);

  const meetingDatesForMonth = useMemo(() => {
    const monthKey = `${currentMonth.getFullYear()}-${currentMonth.getMonth()}`;
    return meetingDates.filter((date) =>
      `${date.getFullYear()}-${date.getMonth()}` === monthKey
    );
  }, [currentMonth, meetingDates]);

  const weekDays = useMemo(() => getWeekDays(selectedDate), [selectedDate]);

  const meetingsForSelectedDay = useMemo(() => {
    return meetingsByDate.get(selectedDateKey) ?? [];
  }, [meetingsByDate, selectedDateKey]);

  const meetingsForSelectedWeek = useMemo(() => {
    const keys = new Set(weekDays.map((day) => toDateKey(day)));
    return calendarMeetings.filter((meeting) => {
      const key = parseMeetingDateKey(meeting.createdAt);
      return key ? keys.has(key) : false;
    });
  }, [calendarMeetings, weekDays]);

  const hasMeetingsInMonth = useMemo(() => {
    const monthKey = `${currentMonth.getFullYear()}-${currentMonth.getMonth()}`;
    return calendarMeetings.some((meeting) => {
      const parsed = toLocalDate(meeting.createdAt);
      if (!parsed) return false;
      return `${parsed.getFullYear()}-${parsed.getMonth()}` === monthKey;
    });
  }, [calendarMeetings, currentMonth]);

  function handleViewAll() {
    calendarAnchorRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    setShowAllMeetings(true);
  }

  return (
    <div
      className="rounded-[14px] p-0 sm:p-5 sm:bg-[rgb(var(--cn-card))] sm:shadow-[0_2px_8px_rgba(0,0,0,0.06)]"
    >
      {/* Mobile header */}
      <div className="sm:hidden">
        <div className="mb-4 flex items-center justify-between px-1">
          <div>
            <p className="text-[13px] font-normal text-muted-foreground">{headerDate}</p>
            <p className="text-[32px] font-extrabold text-foreground">Hoje</p>
          </div>
          <button
            type="button"
            onClick={handleViewAll}
            className="text-[13px] font-medium transition-colors hover:opacity-70"
            style={{ color: "#6C5CE7" }}
          >
            Ver tudo →
          </button>
        </div>
      </div>

      <div
        ref={calendarAnchorRef}
        className="rounded-2xl bg-white p-4 shadow-[0_2px_8px_rgba(0,0,0,0.06)] sm:mx-auto sm:w-full sm:max-w-[760px] sm:p-6"
      >
        {calendarStatus === "loading" ? (
          <p className="text-sm text-muted-foreground">Carregando reuniões...</p>
        ) : null}

        {calendarStatus === "error" ? (
          <p className="text-sm text-destructive">
            {calendarError ?? "Erro ao carregar reuniões."}
          </p>
        ) : null}

        {calendarStatus === "ready" ? (
          <div className="space-y-4 sm:space-y-6">
            <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:justify-center sm:gap-3 sm:pb-2">
              {VIEW_MODES.map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setViewMode(mode)}
                  className={
                    viewMode === mode
                      ? "rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground sm:px-4 sm:py-2 sm:text-sm"
                      : "rounded-full border border-border/70 bg-white px-3 py-1 text-xs font-semibold text-muted-foreground sm:px-4 sm:py-2 sm:text-sm"
                  }
                >
                  {mode === "day"
                    ? "Dia"
                    : mode === "week"
                      ? "Semana"
                      : mode === "month"
                        ? "Mês"
                        : "Ano"}
                </button>
              ))}
            </div>

            <div className="relative flex items-center justify-between sm:justify-center">
              <button
                type="button"
                onClick={() =>
                  setCurrentMonth((prev) =>
                    viewMode === "week" ? addWeeks(prev, -1) : addMonths(prev, -1)
                  )
                }
                className="flex h-9 w-9 items-center justify-center rounded-full border border-border/60 text-foreground transition-colors hover:bg-accent sm:absolute sm:left-0 sm:h-11 sm:w-11"
                aria-label="Mês anterior"
              >
                <ChevronLeft className="h-4 w-4 sm:h-5 sm:w-5" />
              </button>
              <div className="text-center">
                <p className="text-[26px] font-bold capitalize text-foreground sm:text-[32px]">
                  {formatMonthLabel(currentMonth)}
                </p>
                <p className="text-[13px] text-muted-foreground sm:text-[15px]">
                  {formatYearLabel(currentMonth)}
                </p>
              </div>
              <button
                type="button"
                onClick={() =>
                  setCurrentMonth((prev) =>
                    viewMode === "week" ? addWeeks(prev, 1) : addMonths(prev, 1)
                  )
                }
                className="flex h-9 w-9 items-center justify-center rounded-full border border-border/60 text-foreground transition-colors hover:bg-accent sm:absolute sm:right-0 sm:h-11 sm:w-11"
                aria-label="Próximo mês"
              >
                <ChevronRight className="h-4 w-4 sm:h-5 sm:w-5" />
              </button>
            </div>

            {viewMode === "month" ? (
              <Calendar
                mode="single"
                month={currentMonth}
                onMonthChange={(month) => setCurrentMonth(month)}
                selected={selectedDate}
                onSelect={(date) => {
                  if (!date) return;
                  setSelectedDate(date);
                  setShowAllMeetings(false);
                }}
                modifiers={{ hasMeetings: meetingDatesForMonth }}
                modifiersClassNames={{
                  hasMeetings:
                    "[&>button]:relative [&>button]:after:content-[''] [&>button]:after:absolute [&>button]:after:bottom-1 [&>button]:after:left-1/2 [&>button]:after:h-1 [&>button]:after:w-1 [&>button]:after:-translate-x-1/2 [&>button]:after:rounded-full [&>button]:after:bg-primary sm:[&>button]:after:bottom-2 sm:[&>button]:after:h-1.5 sm:[&>button]:after:w-1.5",
                }}
                className="mx-auto w-full max-w-[320px] sm:max-w-[560px]"
                classNames={{
                  month_caption: "hidden",
                  nav: "hidden",
                  weekdays: "mb-1 flex",
                  weekday:
                    "w-8 text-center text-[0.7rem] font-semibold uppercase tracking-[0.12em] text-muted-foreground sm:w-12 sm:text-[0.8rem]",
                  week: "mt-1 flex w-full",
                  day: "h-9 w-8 p-0 text-center sm:h-12 sm:w-12",
                  day_button:
                    "h-9 w-8 rounded-full text-[15px] font-medium text-foreground transition-colors hover:bg-accent sm:h-12 sm:w-12 sm:text-[17px]",
                  selected:
                    "rounded-full bg-primary text-primary-foreground hover:bg-primary",
                  today: "rounded-full border border-primary/60 text-primary",
                  outside: "text-muted-foreground/40",
                }}
              />
            ) : null}

            {viewMode === "week" ? (
              <div className="flex gap-2 overflow-x-auto pb-1 sm:justify-center sm:gap-3">
                {weekDays.map((day) => {
                  const key = toDateKey(day);
                  const isSelected = isSameDay(day, selectedDate);
                  const hasMeeting = meetingsByDate.has(key);
                  const isToday = isSameDay(day, new Date());
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setSelectedDate(day)}
                      className={
                        isSelected
                          ? "flex h-16 w-14 flex-col items-center justify-center rounded-2xl bg-primary text-primary-foreground sm:h-20 sm:w-16"
                          : "flex h-16 w-14 flex-col items-center justify-center rounded-2xl border border-border/70 bg-white sm:h-20 sm:w-16"
                      }
                    >
                      <span className="text-[11px] font-semibold text-muted-foreground sm:text-[12px]">
                        {day.toLocaleDateString("pt-BR", { weekday: "short" })}
                      </span>
                      <span
                        className={
                          isSelected
                            ? "text-[15px] font-semibold sm:text-[17px]"
                            : "text-[15px] font-semibold text-foreground sm:text-[17px]"
                        }
                      >
                        {day.getDate()}
                      </span>
                      {hasMeeting ? (
                        <span
                          className={
                            isSelected
                              ? "h-1.5 w-1.5 rounded-full bg-white sm:h-2 sm:w-2"
                              : "h-1.5 w-1.5 rounded-full bg-primary sm:h-2 sm:w-2"
                          }
                        />
                      ) : isToday ? (
                        <span className="h-1.5 w-1.5 rounded-full border border-primary sm:h-2 sm:w-2" />
                      ) : (
                        <span className="h-1.5 w-1.5 rounded-full bg-transparent sm:h-2 sm:w-2" />
                      )}
                    </button>
                  );
                })}
              </div>
            ) : null}

            {!hasMeetingsInMonth ? (
              <p className="text-sm text-muted-foreground">
                Nenhuma reunião encontrada neste mês.
              </p>
            ) : null}

            {meetingsForSelectedDay.length === 0 && !showAllMeetings ? (
              <EmptyState
                className="border-0 bg-transparent"
                title="Nenhuma reunião encontrada"
                description="Não há reuniões para esta data."
              />
            ) : (
              <div className="space-y-3">
                {(showAllMeetings ? meetingsForSelectedDay : meetingsForSelectedDay.slice(0, 3)).map(
                  (meeting) => {
                    const title = meeting.title ?? meeting.clientName ?? "Reunião";
                    const subtitle = meeting.title && meeting.clientName ? meeting.clientName : null;
                    const timeLabel = formatMeetingTime(meeting.createdAt);
                    const relativeLabel = formatRelativeLabel(meeting.createdAt);
                    const normalizedStatus = normalizeMeetingStatus(meeting.status);

                    return (
                      <button
                        key={meeting.id}
                        type="button"
                        onClick={() => onRowClick(meeting.id)}
                        className="flex w-full items-start justify-between gap-3 rounded-xl bg-white px-4 py-3 text-left shadow-[0_2px_8px_rgba(0,0,0,0.07)] sm:px-5 sm:py-4"
                      >
                        <div className="space-y-1">
                          <p className="text-[14px] font-semibold text-primary sm:text-[16px]">
                            {title}
                          </p>
                          <p className="text-[12px] text-muted-foreground sm:text-[14px]">
                            {timeLabel ? `Hoje, ${timeLabel}` : "Horário não definido"}
                            {subtitle ? ` · ${subtitle}` : ""}
                          </p>
                          <StatusBadge status={normalizedStatus} />
                        </div>
                        <div className="flex items-center gap-2">
                          {relativeLabel ? (
                            <span className="text-[12px] text-muted-foreground sm:text-[14px]">
                              {relativeLabel}
                            </span>
                          ) : null}
                          <Trash2 className="hidden h-4 w-4 text-muted-foreground/60 sm:block sm:h-5 sm:w-5" />
                        </div>
                      </button>
                    );
                  }
                )}

                {!showAllMeetings && meetingsForSelectedDay.length > 3 ? (
                  <button
                    type="button"
                    onClick={() => setShowAllMeetings(true)}
                    className="text-sm font-semibold text-primary"
                  >
                    {`Ver mais (${meetingsForSelectedDay.length - 3})`}
                  </button>
                ) : null}
              </div>
            )}

            {showAllMeetings ? (
              <div className="space-y-3">
                {Array.from(meetingsByDate.entries())
                  .filter(([key]) => {
                    const [year, month] = key.split("-").map(Number);
                    return (
                      year === currentMonth.getFullYear() &&
                      month - 1 === currentMonth.getMonth()
                    );
                  })
                  .sort(([a], [b]) => a.localeCompare(b))
                  .map(([dayKey, dayMeetings]) => {
                    const [year, month, day] = dayKey.split("-").map(Number);
                    const dayLabel = new Date(year, month - 1, day).toLocaleDateString(
                      "pt-BR",
                      {
                        day: "2-digit",
                        month: "short",
                      }
                    );
                    return (
                      <div key={dayKey} className="space-y-2">
                        <p className="text-xs font-semibold uppercase text-muted-foreground sm:text-[13px]">
                          {dayLabel}
                        </p>
                        {dayMeetings.map((meeting) => {
                          const title = meeting.title ?? meeting.clientName ?? "Reunião";
                          const timeLabel = formatMeetingTime(meeting.createdAt);
                          const relativeLabel = formatRelativeLabel(meeting.createdAt);
                          return (
                            <button
                              key={meeting.id}
                              type="button"
                              onClick={() => onRowClick(meeting.id)}
                              className="flex w-full items-start justify-between gap-3 rounded-xl bg-white px-4 py-3 text-left shadow-[0_2px_8px_rgba(0,0,0,0.07)] sm:px-5 sm:py-4"
                            >
                              <div className="space-y-1">
                                <p className="text-[14px] font-semibold text-primary sm:text-[16px]">
                                  {title}
                                </p>
                                <p className="text-[12px] text-muted-foreground sm:text-[14px]">
                                  {timeLabel ? `Hoje, ${timeLabel}` : "Horário não definido"}
                                </p>
                                <StatusBadge status={normalizeMeetingStatus(meeting.status)} />
                              </div>
                              <div className="flex items-center gap-2">
                                {relativeLabel ? (
                                  <span className="text-[12px] text-muted-foreground sm:text-[14px]">
                                    {relativeLabel}
                                  </span>
                                ) : null}
                                <Trash2 className="hidden h-4 w-4 text-muted-foreground/60 sm:block sm:h-5 sm:w-5" />
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    );
                  })}

                {hasMeetingsInMonth ? null : (
                  <EmptyState
                    className="border-0 bg-transparent"
                    title="Nenhuma reunião encontrada"
                    description="Não há reuniões para este mês."
                  />
                )}

                <button
                  type="button"
                  onClick={() => setShowAllMeetings(false)}
                  className="text-sm font-semibold text-primary"
                >
                  Mostrar menos
                </button>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="mt-6 flex justify-center sm:hidden">
        <button
          type="button"
          aria-label="Criar nova reunião"
          title="Criar nova reunião"
          onClick={onNewMeeting}
          className="flex h-14 w-14 items-center justify-center rounded-[16px] bg-primary text-primary-foreground shadow-[0_4px_16px_rgba(59,130,246,0.35)]"
        >
          <Plus className="h-6 w-6" />
        </button>
      </div>

      {/* Header */}
      <div className="mb-4 hidden items-center justify-between sm:flex">
        <p
          className="font-display text-lg font-bold"
          style={{ color: "rgb(var(--cn-ink))" }}
        >
          Reuniões Recentes
        </p>
        <button
          type="button"
          onClick={handleViewAll}
          className="text-[13px] font-medium transition-colors hover:opacity-70"
          style={{ color: "#6C5CE7" }}
        >
          Ver tudo →
        </button>
      </div>

      {/* Column header — desktop only */}
      <div
        className="hidden grid-cols-[1fr_120px_140px_60px] gap-2 px-3 pb-2.5 text-[10px] font-bold uppercase tracking-[0.1em] sm:grid"
        style={{
          color: "rgb(var(--cn-muted))",
        }}
      >
        <p>Cliente / Título</p>
        <p>Data</p>
        <p>Status</p>
        <p className="text-right">Ações</p>
      </div>

      {/* Rows */}
      <div className="mt-1 hidden sm:block">
        {meetings.map((m) => (
          <MeetingRow
            key={m.id}
            meeting={m}
            onRetry={onRetry}
            onViewProcessing={onViewProcessing}
            onClick={onRowClick}
          />
        ))}
      </div>
    </div>
  );
}
