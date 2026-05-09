"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";

interface CalendarMeeting {
  id: string;
  title: string | null;
  clientName: string | null;
  createdAt: string;
  status: "completed" | "processing" | "failed" | string;
}

const VIEW_MODES = ["day", "week", "month", "year"] as const;
type ViewMode = (typeof VIEW_MODES)[number];

function toDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
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

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
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

function buildMeetingsRoute(date: Date): string {
  return `/dashboard/meetings?data=${toDateKey(date)}`;
}

export function DashboardCalendarPanel() {
  const router = useRouter();
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [currentMonth, setCurrentMonth] = useState<Date>(new Date());
  const [viewMode, setViewMode] = useState<ViewMode>("month");
  const [calendarMeetings, setCalendarMeetings] = useState<CalendarMeeting[]>([]);
  const [calendarStatus, setCalendarStatus] = useState<"loading" | "ready" | "error">("loading");
  const [calendarError, setCalendarError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadMeetings() {
      setCalendarStatus("loading");
      setCalendarError(null);

      try {
        const response = await fetch("/api/meetings");
        const body = (await response.json()) as { meetings?: CalendarMeeting[]; error?: string };
        if (!response.ok) {
          throw new Error(body.error ?? "Erro ao carregar reuniões.");
        }
        if (!active) return;

        const items = Array.isArray(body.meetings) ? body.meetings : [];
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

    void loadMeetings();
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
    return meetingDates.filter((date) => `${date.getFullYear()}-${date.getMonth()}` === monthKey);
  }, [currentMonth, meetingDates]);

  const weekDays = useMemo(() => getWeekDays(selectedDate), [selectedDate]);

  function navigateToDayIfNeeded(date: Date) {
    setSelectedDate(date);
    router.push(buildMeetingsRoute(date));
  }

  return (
    <div className="calendar-wrapper rounded-2xl border border-border/60 bg-card p-4 shadow-[0_2px_8px_rgba(0,0,0,0.06)] sm:p-5">
      {calendarStatus === "loading" ? (
        <p className="text-sm text-muted-foreground">Carregando reuniões...</p>
      ) : null}

      {calendarStatus === "error" ? (
        <p className="text-sm text-destructive">{calendarError ?? "Erro ao carregar reuniões."}</p>
      ) : null}

      {calendarStatus === "ready" ? (
        <div className="flex w-full flex-col items-center space-y-4">
          <div className="flex w-full flex-wrap items-center justify-center gap-2 pb-1">
            {VIEW_MODES.map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setViewMode(mode)}
                className={
                  viewMode === mode
                    ? "calendar-toggle-pill active rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground"
                    : "calendar-toggle-pill rounded-full border border-border/70 bg-background px-3 py-1 text-xs font-semibold text-muted-foreground"
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

          <div className="calendar-header">
            <button
              type="button"
              onClick={() =>
                setCurrentMonth((prev) =>
                  viewMode === "week" ? addWeeks(prev, -1) : addMonths(prev, -1)
                )
              }
              className="calendar-nav-button flex h-9 w-9 items-center justify-center rounded-full border border-border/60 bg-background text-foreground transition-colors hover:bg-accent"
              aria-label="Mês anterior"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <div className="calendar-title">
              <p className="text-[20px] font-bold capitalize text-foreground">
                {formatMonthLabel(currentMonth)}
              </p>
              <p className="text-[12px] text-muted-foreground">{formatYearLabel(currentMonth)}</p>
            </div>
            <button
              type="button"
              onClick={() =>
                setCurrentMonth((prev) =>
                  viewMode === "week" ? addWeeks(prev, 1) : addMonths(prev, 1)
                )
              }
              className="calendar-nav-button flex h-9 w-9 items-center justify-center rounded-full border border-border/60 bg-background text-foreground transition-colors hover:bg-accent"
              aria-label="Próximo mês"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          {viewMode === "month" ? (
            <Calendar
              mode="single"
              month={currentMonth}
              onMonthChange={(month) => setCurrentMonth(month)}
              selected={selectedDate}
              onDayClick={(date) => navigateToDayIfNeeded(date)}
              onSelect={(date) => {
                if (!date) return;
                navigateToDayIfNeeded(date);
              }}
              modifiers={{ hasMeetings: meetingDatesForMonth }}
              modifiersClassNames={{
                hasMeetings:
                  "[&>button]:relative [&>button]:after:content-[''] [&>button]:after:absolute [&>button]:after:bottom-1 [&>button]:after:left-1/2 [&>button]:after:h-1 [&>button]:after:w-1 [&>button]:after:-translate-x-1/2 [&>button]:after:rounded-full [&>button]:after:bg-primary",
              }}
              className="calendar-root mx-auto w-full max-w-[320px] text-center"
              classNames={{
                month: "w-full space-y-3",
                month_caption: "hidden",
                nav: "hidden",
                month_grid: "calendar-month-grid w-full border-collapse table-fixed",
                weekdays: "calendar-weekdays",
                weekday:
                  "calendar-weekday text-[0.7rem] font-semibold uppercase tracking-[0.12em] text-muted-foreground",
                week: "calendar-week",
                day: "calendar-day p-0 text-center align-middle",
                day_button:
                  "calendar-day-button flex items-center justify-center rounded-full text-[14px] font-medium text-foreground transition-colors hover:bg-accent",
                selected: "rounded-full bg-primary text-primary-foreground hover:bg-primary",
                today: "rounded-full border border-primary/60 text-primary",
                outside: "calendar-day other-month text-muted-foreground/40",
              }}
            />
          ) : null}

          {viewMode === "week" ? (
            <div className="calendar-week-grid pb-1 text-center">
              {weekDays.map((day) => {
                const key = toDateKey(day);
                const isSelected = isSameDay(day, selectedDate);
                const hasMeeting = meetingsByDate.has(key);
                const isToday = isSameDay(day, new Date());

                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => navigateToDayIfNeeded(day)}
                    className={
                      isSelected
                        ? "calendar-day calendar-week-day has-meeting flex w-full max-w-[56px] aspect-square flex-col items-center justify-center rounded-2xl bg-primary p-1.5 text-primary-foreground"
                        : "calendar-day calendar-week-day flex w-full max-w-[56px] aspect-square flex-col items-center justify-center rounded-2xl border border-border/70 bg-background p-1.5 text-foreground"
                    }
                  >
                    <span className={isSelected ? "text-[11px] font-semibold text-primary-foreground/80" : "text-[11px] font-semibold text-muted-foreground"}>
                      {day.toLocaleDateString("pt-BR", { weekday: "short" })}
                    </span>
                    <span
                      className={
                        isSelected
                          ? "text-[15px] font-semibold"
                          : "text-[15px] font-semibold text-foreground"
                      }
                    >
                      {day.getDate()}
                    </span>
                    {hasMeeting ? (
                      <span
                        className={
                          isSelected
                            ? "h-1.5 w-1.5 rounded-full bg-white"
                            : "h-1.5 w-1.5 rounded-full bg-primary"
                        }
                      />
                    ) : isToday ? (
                      <span className="h-1.5 w-1.5 rounded-full border border-primary" />
                    ) : (
                      <span className="h-1.5 w-1.5 rounded-full bg-transparent" />
                    )}
                  </button>
                );
              })}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}