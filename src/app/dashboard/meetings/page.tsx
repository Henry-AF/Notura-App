"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw, Search, Sparkles, X } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  EmptyState,
  FilterBar,
  LoadingState,
  PageHeader,
  PageShell,
  SectionCard,
  StatusBadge,
} from "@/components/ui/app";
import {
  fetchMeetings,
  type MeetingsPageMeeting as Meeting,
  type MeetingsPageStatus as Status,
} from "./meetings-api";

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
  onViewProcessing,
  onOpen,
}: {
  meeting: Meeting;
  onRetry: (id: string) => void;
  onViewProcessing: (id: string) => void;
  onOpen: (id: string) => void;
}) {
  return (
    <article
      role="button"
      tabIndex={0}
      onClick={() => onOpen(meeting.id)}
      onKeyDown={(event) => {
        if (event.key === "Enter") onOpen(meeting.id);
      }}
      className="grid cursor-pointer grid-cols-[1fr_120px_140px_70px] items-center gap-2 rounded-lg px-3 py-3 transition-colors hover:bg-accent/40"
    >
      <div className="flex min-w-0 items-center gap-3">
        <Avatar className="h-8 w-8 shrink-0">
          <AvatarFallback name={meeting.clientName} className="text-[11px] font-semibold" />
        </Avatar>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-foreground">{meeting.clientName}</p>
          <p className="truncate text-xs text-muted-foreground">{meeting.title}</p>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">{meeting.date}</p>
      <MeetingStatusBadge status={meeting.status} />

      <div
        className="flex items-center justify-end"
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
    </article>
  );
}

export default function MeetingsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<Status | "all">("all");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const data = await fetchMeetings();
        if (!cancelled) {
          setMeetings(data);
        }
      } catch {
        if (!cancelled) {
          setMeetings([]);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

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
      const matchesQuery =
        !query ||
        meeting.clientName.toLowerCase().includes(query) ||
        meeting.title.toLowerCase().includes(query) ||
        meeting.date.toLowerCase().includes(query);
      const matchesStatus = statusFilter === "all" || meeting.status === statusFilter;

      return matchesQuery && matchesStatus;
    });
  }, [meetings, search, statusFilter]);

  useEffect(() => {
    meetings.slice(0, 12).forEach((meeting) => {
      void router.prefetch(`/dashboard/meetings/${meeting.id}`);
    });
  }, [meetings, router]);

  return (
    <PageShell>
      <PageHeader
        title="Reuniões"
        description={
          loading
            ? "Carregando..."
            : `${meetings.length} ${meetings.length !== 1 ? "reuniões" : "reunião"} no total`
        }
      />

      <FilterBar
        left={
          <div className="relative max-w-md">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Buscar por cliente ou título..."
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

      <SectionCard className="rounded-xl">
        <div className="grid grid-cols-[1fr_120px_140px_70px] gap-2 border-b px-3 pb-3 text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground">
          <p>Cliente / Titulo</p>
          <p>Data</p>
          <p>Status</p>
          <p className="text-right">Ações</p>
        </div>

        {loading ? (
          <LoadingState className="mt-3 min-h-[180px] border-0 bg-transparent" />
        ) : null}

        {!loading && filtered.length === 0 ? (
          <EmptyState
            className="mt-3 min-h-[180px] border-0 bg-transparent"
            title="Nenhuma reunião encontrada"
            description={
              search || statusFilter !== "all"
                ? "Tente ajustar os filtros para encontrar reuniões."
                : "Você ainda não possui reuniões nesta conta."
            }
          />
        ) : null}

        {!loading
          ? filtered.map((meeting) => (
              <MeetingRow
                key={meeting.id}
                meeting={meeting}
                onRetry={handleRetry}
                onViewProcessing={(id) => router.push(`/dashboard/meetings/${id}`)}
                onOpen={(id) => router.push(`/dashboard/meetings/${id}`)}
              />
            ))
          : null}
      </SectionCard>
    </PageShell>
  );
}
