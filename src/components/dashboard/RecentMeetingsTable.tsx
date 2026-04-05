"use client";

import React from "react";
import { RefreshCw, Sparkles } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Meeting {
  id: string;
  clientName: string;
  title: string;
  date: string;
  status: "completed" | "processing" | "failed";
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
  const avatarStyle = getAvatarStyle(meeting.clientName);
  const initial = meeting.clientName.trim()[0]?.toUpperCase() ?? "?";

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onClick(meeting.id)}
      onKeyDown={(e) => e.key === "Enter" && onClick(meeting.id)}
      style={{
        display: "grid",
        gridTemplateColumns: "1fr 120px 140px 60px",
        padding: "14px 12px",
        borderRadius: "8px",
        alignItems: "center",
        cursor: "pointer",
        transition: "background 0.15s",
      }}
      onMouseEnter={(e) => ((e.currentTarget as HTMLDivElement).style.background = "rgb(var(--cn-card2))")}
      onMouseLeave={(e) => ((e.currentTarget as HTMLDivElement).style.background = "transparent")}
      className="responsive-meeting-row"
    >
      {/* Client + title */}
      <div className="flex items-center gap-3 min-w-0">
        <div
          style={{
            width: 34,
            height: 34,
            borderRadius: "50%",
            background: avatarStyle.bg,
            color: avatarStyle.color,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "13px",
            fontWeight: 700,
            flexShrink: 0,
          }}
        >
          {initial}
        </div>
        <div className="min-w-0">
          <p style={{ fontFamily: "Inter, sans-serif", fontWeight: 600, fontSize: "14px", color: "rgb(var(--cn-ink))" }}>
            {meeting.clientName}
          </p>
          <p
            style={{
              fontFamily: "Inter, sans-serif",
              fontWeight: 400,
              fontSize: "12px",
              color: "rgb(var(--cn-muted))",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
              maxWidth: "200px",
            }}
          >
            {meeting.title}
          </p>
        </div>
      </div>

      {/* Date */}
      <p
        className="meeting-date-col"
        style={{ fontFamily: "Inter, sans-serif", fontSize: "13px", color: "rgb(var(--cn-ink2))" }}
      >
        {meeting.date}
      </p>

      {/* Status */}
      <div className="meeting-status-col">
        <StatusBadge status={meeting.status} />
      </div>

      {/* Actions */}
      <div
        className="meeting-action-col flex items-center justify-end"
        onClick={(e) => e.stopPropagation()}
      >
        {meeting.status === "processing" && (
          <button
            type="button"
            title="Ver processo"
            onClick={() => onViewProcessing(meeting.id)}
            style={{
              width: 30,
              height: 30,
              borderRadius: "8px",
              background: "rgb(var(--cn-card2))",
              border: "none",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#A29BFE",
            }}
          >
            <Sparkles style={{ width: 14, height: 14 }} />
          </button>
        )}
        {meeting.status === "failed" && (
          <button
            type="button"
            title="Reprocessar"
            onClick={() => onRetry(meeting.id)}
            style={{
              width: 30,
              height: 30,
              borderRadius: "8px",
              background: "rgba(255,107,107,0.1)",
              border: "none",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#FF6B6B",
            }}
          >
            <RefreshCw style={{ width: 14, height: 14 }} />
          </button>
        )}
      </div>
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
}

export function RecentMeetingsTable({
  meetings,
  onViewAll,
  onRetry,
  onViewProcessing,
  onRowClick,
}: RecentMeetingsTableProps) {
  return (
    <div
      style={{
        background: "rgb(var(--cn-card))",
        border: "1px solid rgb(var(--cn-border))",
        borderRadius: "14px",
        padding: "20px",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "16px",
        }}
      >
        <p
          style={{
            fontFamily: "'Plus Jakarta Sans', sans-serif",
            fontWeight: 700,
            fontSize: "18px",
            color: "rgb(var(--cn-ink))",
          }}
        >
          Reuniões Recentes
        </p>
        <button
          type="button"
          onClick={onViewAll}
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            fontFamily: "Inter, sans-serif",
            fontWeight: 500,
            fontSize: "13px",
            color: "#6C5CE7",
            padding: 0,
            transition: "color 0.15s",
          }}
          onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.color = "#A29BFE")}
          onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.color = "#6C5CE7")}
        >
          Ver tudo →
        </button>
      </div>

      {/* Table header */}
      <div
        className="hidden sm:grid"
        style={{
          gridTemplateColumns: "1fr 120px 140px 60px",
          padding: "0 12px 10px",
          borderBottom: "1px solid rgb(var(--cn-border))",
        }}
      >
        {["CLIENTE / TÍTULO", "DATA", "STATUS", "AÇÕES"].map((col) => (
          <p
            key={col}
            style={{
              fontSize: "10px",
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.1em",
              color: "rgb(var(--cn-muted))",
            }}
          >
            {col}
          </p>
        ))}
      </div>

      {/* Rows */}
      <div>
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
