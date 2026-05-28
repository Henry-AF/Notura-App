"use client";

import React, { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import posthog from "posthog-js";
import { Plus, RefreshCw, Search, Sparkles, X, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import {
  DashboardListSection,
  EmptyState,
  FilterBar,
  PageHeader,
  PageShell,
  StatusBadge,
} from "@/components/ui/app";
import {
  type MeetingsPageMeeting as Meeting,
  type MeetingsPageStatus as Status,
} from "./meetings-types";
import { cancelMeetingProcessing } from "./[id]/meeting-client-api";

const STATUS_OPTIONS: { value: Status | "all"; label: string }[] = [
  { value: "all", label: "Todos" },
  { value: "completed", label: "Concluido" },
  { value: "processing", label: "Processando" },
  { value: "failed", label: "Falhou" },
];

function MeetingStatusBadge({ status }: { status: Status }) {
  if (status === "completed") return <StatusBadge status="completed" />;
  if (status === "processing") return <StatusBadge status="processing" />;
  return <StatusBadge status="failed" />;
}

function MeetingRow({
  meeting,
  onRetry,
  onCancel,
  isCanceling,
  onViewProcessing,
  onOpen,
}: {
  meeting: Meeting;
  onRetry: (id: string) => void;
  onCancel: (id: string) => void;
  isCanceling: boolean;
  onViewProcessing: (id: string) => void;
  onOpen: (id: string) => void;
}) {
  const actionButton = (
    <div
      className="flex shrink-0 items-center justify-end gap-1"
      onClick={(event) => event.stopPropagation()}
    >
      {meeting.status === "processing" ? (
        <>
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
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-8 w-8 rounded-md p-0 text-destructive"
            onClick={() => onCancel(meeting.id)}
            disabled={isCanceling}
            aria-label="Cancelar processamento"
          >
            <XCircle className="h-4 w-4" />
          </Button>
        </>
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
      className="flex cursor-pointer items-center gap-3 rounded-lg px-2 py-2.5 transition-colors hover:bg-accent/40 sm:grid sm:grid-cols-[1fr_120px_140px_92px] sm:gap-2 sm:px-3 sm:py-3"
    >
      {/* ── Mobile-only standalone avatar ──────────────────────────── */}
      <Avatar className="h-9 w-9 shrink-0 sm:hidden">
        <AvatarFallback name={meeting.title} className="text-[11px] font-semibold" />
      </Avatar>

      {/* ── Column 1: title ─────────────────────────────────────────── */}
      <div className="min-w-0 flex-1 sm:flex sm:items-center sm:gap-3">
        {/* Desktop avatar (inside column 1) */}
        <Avatar className="hidden h-8 w-8 shrink-0 sm:flex">
          <AvatarFallback name={meeting.title} className="text-[11px] font-semibold" />
        </Avatar>

        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-foreground">{meeting.title}</p>
          {meeting.groupName ? (
            <p className="truncate text-xs text-muted-foreground">{meeting.groupName}</p>
          ) : null}
        </div>

        {/* Mobile-only: date + status below the name */}
        <div className="mt-1.5 flex flex-wrap items-center gap-2 sm:hidden">
          <span className="text-[11px] text-muted-foreground">{meeting.date}</span>
          <MeetingStatusBadge status={meeting.status} />
        </div>
      </div>

      {/* ── Column 2: date (desktop only) ──────────────────────────── */}
      <p className="hidden text-xs text-muted-foreground sm:block">{meeting.date}</p>

      {/* ── Column 3: status (desktop only) ────────────────────────── */}
      <div className="hidden sm:block">
        <MeetingStatusBadge status={meeting.status} />
      </div>

      {/* ── Column 4: actions ──────────────────────────────────────── */}
      {actionButton}
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
  const [cancelingMeetingId, setCancelingMeetingId] = useState<string | null>(null);

  const handleRetry = useCallback(async (id: string) => {
    posthog.capture("meeting_retry_clicked", { meeting_id: id });
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

  const handleCancelProcessing = useCallback(async (id: string) => {
    setCancelingMeetingId(id);
    try {
      await cancelMeetingProcessing(id);
      setMeetings((previous) =>
        previous.map((meeting) =>
          meeting.id === id ? { ...meeting, status: "failed" as const } : meeting
        )
      );
    } catch {
      // silently ignore for now; page-level toast will be added in a later pass
    } finally {
      setCancelingMeetingId(null);
    }
  }, []);

  const filtered = useMemo(() => {
    const query = search.toLowerCase();

    return meetings.filter((meeting) => {
      const matchesQuery =
        !query ||
        meeting.title.toLowerCase().includes(query) ||
        meeting.date.toLowerCase().includes(query);
      const matchesStatus = statusFilter === "all" || meeting.status === statusFilter;

      return matchesQuery && matchesStatus;
    });
  }, [meetings, search, statusFilter]);

  return (
    <PageShell>
      <PageHeader
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Reuniões" },
        ]}
        title="Reuniões"
        description={`${meetings.length} ${meetings.length !== 1 ? "reuniões" : "reunião"} no total`}
        actions={
          <Button asChild size="lg" className="rounded-full px-6">
            <Link href="/dashboard/recording">
              <Plus className="h-[18px] w-[18px]" />
              Nova reunião
            </Link>
          </Button>
        }
      />

      <FilterBar
        left={
          <div className="relative max-w-md">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Buscar por título..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="pl-9 pr-9"
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
        }
        right={
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
        }
      />

      <DashboardListSection
        className="rounded-xl"
        contentClassName="p-3 pt-3 sm:p-6 sm:pt-6"
        header={
          <div className="grid grid-cols-[1fr_120px_140px_92px] gap-2 text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground">
            <p>Título</p>
            <p>Data</p>
            <p>Status</p>
            <p className="text-right">Ações</p>
          </div>
        }
        emptyState={
          filtered.length === 0 ? (
            <EmptyState
              className="mt-3 min-h-[180px] border-0 bg-transparent"
              title="Nenhuma reunião encontrada"
              description={
                search || statusFilter !== "all"
                  ? "Tente ajustar os filtros para encontrar reuniões."
                  : "Você ainda não possui reuniões nesta conta."
              }
            />
          ) : undefined
        }
      >
        {filtered.map((meeting) => (
          <MeetingRow
            key={meeting.id}
            meeting={meeting}
            onRetry={handleRetry}
            onCancel={handleCancelProcessing}
            isCanceling={cancelingMeetingId === meeting.id}
            onViewProcessing={(id) => router.push(`/dashboard/meetings/${id}`)}
            onOpen={(id) => router.push(`/dashboard/meetings/${id}`)}
          />
        ))}
      </DashboardListSection>
    </PageShell>
  );
}
