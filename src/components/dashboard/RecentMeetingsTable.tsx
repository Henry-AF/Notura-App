"use client";

import React from "react";
import { RefreshCw, Sparkles } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Meeting {
  id: string;
  title: string;
  date: string;
  status: "completed" | "processing" | "failed";
  groupName?: string | null;
}

// ─── Avatar ───────────────────────────────────────────────────────────────────

const AVATAR_COLORS: Record<string, { bg: string; color: string }> = {
  A: { bg: "rgba(116,192,252,0.15)", color: "#4A8FD9" },
  N: { bg: "rgba(162,155,254,0.15)", color: "#6C5CE7" },
  H: { bg: "rgba(255,138,138,0.15)", color: "#D94444" },
};

function getAvatarStyle(name: string): { bg: string; color: string } {
  const initial = name.trim()[0]?.toUpperCase() ?? "?";
  if (AVATAR_COLORS[initial]) return AVATAR_COLORS[initial];
  // Hash fallback — semi-transparent so it works in both light and dark
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  const hue = Math.abs(hash) % 360;
  return { bg: `hsla(${hue},60%,55%,0.15)`, color: `hsl(${hue},55%,42%)` };
}

// ─── Status badge ─────────────────────────────────────────────────────────────

const STATUS_MAP = {
  completed: { dot: "#4ECB71", label: "Concluído", bg: "rgba(78,203,113,0.1)", color: "#4ECB71" },
  processing: { dot: "#74C0FC", label: "Processando", bg: "rgba(116,192,252,0.1)", color: "#74C0FC" },
  failed: { dot: "#FF6B6B", label: "Falhou", bg: "rgba(255,107,107,0.1)", color: "#FF6B6B" },
} as const;

function StatusBadge({ status }: { status: Meeting["status"] }) {
  const s = STATUS_MAP[status];
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "4px 10px",
        borderRadius: "999px",
        fontSize: "12px",
        fontWeight: 600,
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
  const avatarStyle = getAvatarStyle(meeting.title);
  const initial = meeting.title.trim()[0]?.toUpperCase() ?? "?";

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
      className="flex cursor-pointer items-center gap-3 rounded-xl px-2 py-2.5 transition-colors hover:bg-[rgb(var(--cn-card2))] sm:grid sm:grid-cols-[1fr_120px_140px_60px] sm:gap-2 sm:px-3 sm:py-3"
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

      {/* ── Column 1: title ─────────────────────────────────────────────── */}
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
            {meeting.title}
          </p>
          {meeting.groupName ? (
            <p style={{ fontSize: "11px", color: "rgb(var(--cn-ink3))", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {meeting.groupName}
            </p>
          ) : null}
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
  dataOnboarding?: string;
}

export function RecentMeetingsTable({
  meetings,
  onViewAll,
  onRetry,
  onViewProcessing,
  onRowClick,
  dataOnboarding,
}: RecentMeetingsTableProps) {
  return (
    <div
      data-onboarding={dataOnboarding}
      className="rounded-[14px] p-3 sm:p-5"
      style={{
        background: "rgb(var(--cn-card))",
        boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
      }}
    >
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <p
          className="font-display text-lg font-bold"
          style={{ color: "rgb(var(--cn-ink))" }}
        >
          Reuniões Recentes
        </p>
        <button
          type="button"
          onClick={onViewAll}
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
        <p>Título</p>
        <p>Data</p>
        <p>Status</p>
        <p className="text-right">Ações</p>
      </div>

      {/* Rows */}
      <div className="mt-1">
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
