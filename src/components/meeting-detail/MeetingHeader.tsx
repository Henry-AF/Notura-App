"use client";

import React from "react";
import { Calendar, Share2, Pencil } from "lucide-react";

// ─── Status badge ─────────────────────────────────────────────────────────────

const STATUS_CONFIG = {
  completed: { bg: "rgba(78,203,113,0.15)", color: "#4ECB71", label: "Concluído" },
  processing: { bg: "rgba(116,192,252,0.15)", color: "#74C0FC", label: "Processando" },
  failed: { bg: "rgba(255,107,107,0.15)", color: "#FF6B6B", label: "Falhou" },
  scheduled: { bg: "rgba(255,169,77,0.15)", color: "#FFA94D", label: "Agendado" },
} as const;

// ─── Avatar helpers ───────────────────────────────────────────────────────────

function hashColor(name: string): { bg: string; color: string } {
  const PALETTE = [
    { bg: "rgba(116,192,252,0.15)", color: "#4A8FD9" },
    { bg: "rgba(162,155,254,0.15)", color: "#7B6EE0" },
    { bg: "rgba(255,138,138,0.15)", color: "#D94F4F" },
    { bg: "rgba(78,203,113,0.15)", color: "#3AAD66" },
    { bg: "rgba(255,169,77,0.15)", color: "#D98B2A" },
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return PALETTE[Math.abs(hash) % PALETTE.length];
}

function ParticipantAvatars({
  participants,
  maxVisible = 3,
}: {
  participants: Array<{ name: string; avatarUrl?: string }>;
  maxVisible?: number;
}) {
  const visible = participants.slice(0, maxVisible);
  const extra = participants.length - maxVisible;

  return (
    <div style={{ display: "flex", alignItems: "center" }}>
      {visible.map((p, i) => {
        const style = hashColor(p.name);
        const initial = p.name.trim()[0]?.toUpperCase() ?? "?";
        return (
          <div
            key={i}
            title={p.name}
            style={{
              width: 28,
              height: 28,
              borderRadius: "50%",
              background: style.bg,
              color: style.color,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 11,
              fontWeight: 700,
              marginLeft: i === 0 ? 0 : -8,
              border: "2px solid rgb(var(--cn-bg))",
              position: "relative",
            }}
          >
            {initial}
          </div>
        );
      })}
      {extra > 0 && (
        <div
          style={{
            width: 28,
            height: 28,
            borderRadius: "50%",
            background: "rgb(var(--cn-card2))",
            color: "rgb(var(--cn-ink2))",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 11,
            fontWeight: 700,
            marginLeft: -8,
            border: "2px solid rgb(var(--cn-bg))",
            flexShrink: 0,
          }}
        >
          +{extra}
        </div>
      )}
    </div>
  );
}

// ─── MeetingHeader ────────────────────────────────────────────────────────────

export interface MeetingHeaderProps {
  clientName: string;
  date: string;
  status: "completed" | "processing" | "failed" | "scheduled";
  participants: Array<{ name: string; avatarUrl?: string }>;
  onShare: () => void;
  onEdit: () => void;
}

const actionBtnBase: React.CSSProperties = {
  background: "transparent",
  border: "1px solid rgb(var(--cn-border))",
  borderRadius: 8,
  padding: "8px 16px",
  color: "rgb(var(--cn-ink))",
  fontFamily: "Inter, sans-serif",
  fontWeight: 600,
  fontSize: 13,
  display: "flex",
  alignItems: "center",
  gap: 6,
  cursor: "pointer",
  transition: "all 0.15s",
};

export function MeetingHeader({
  clientName,
  date,
  status,
  participants,
  onShare,
  onEdit,
}: MeetingHeaderProps) {
  const statusCfg = STATUS_CONFIG[status];

  return (
    <div style={{ marginBottom: 20 }}>
      {/* Row 1: title + action buttons */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16 }}>
        <h1
          style={{
            fontFamily: "'Plus Jakarta Sans', sans-serif",
            fontWeight: 800,
            fontSize: 48,
            color: "rgb(var(--cn-ink))",
            lineHeight: 1.1,
            margin: 0,
          }}
        >
          {clientName}
        </h1>

        <div style={{ display: "flex", gap: 8, flexShrink: 0, marginTop: 6 }}>
          <button
            type="button"
            onClick={onShare}
            style={actionBtnBase}
            onMouseEnter={(e) => {
              const el = e.currentTarget as HTMLButtonElement;
              el.style.background = "rgb(var(--cn-card))";
              el.style.borderColor = "rgb(var(--cn-border))";
            }}
            onMouseLeave={(e) => {
              const el = e.currentTarget as HTMLButtonElement;
              el.style.background = "transparent";
              el.style.borderColor = "rgb(var(--cn-border))";
            }}
          >
            <Share2 style={{ width: 14, height: 14 }} />
            Compartilhar
          </button>
          <button
            type="button"
            onClick={onEdit}
            style={actionBtnBase}
            onMouseEnter={(e) => {
              const el = e.currentTarget as HTMLButtonElement;
              el.style.background = "rgb(var(--cn-card))";
              el.style.borderColor = "rgb(var(--cn-border))";
            }}
            onMouseLeave={(e) => {
              const el = e.currentTarget as HTMLButtonElement;
              el.style.background = "transparent";
              el.style.borderColor = "rgb(var(--cn-border))";
            }}
          >
            <Pencil style={{ width: 14, height: 14 }} />
            Editar
          </button>
        </div>
      </div>

      {/* Row 2: date, status badge, participants */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 16,
          marginTop: 10,
          flexWrap: "wrap",
        }}
      >
        {/* Date */}
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <Calendar style={{ width: 14, height: 14, color: "rgb(var(--cn-muted))", flexShrink: 0 }} />
          <span style={{ fontFamily: "Inter, sans-serif", fontSize: 14, color: "rgb(var(--cn-muted))" }}>
            {date}
          </span>
        </div>

        {/* Status badge */}
        <span
          style={{
            padding: "4px 12px",
            borderRadius: 999,
            fontFamily: "Inter, sans-serif",
            fontWeight: 600,
            fontSize: 11,
            textTransform: "uppercase",
            letterSpacing: "0.06em",
            background: statusCfg.bg,
            color: statusCfg.color,
          }}
        >
          {statusCfg.label}
        </span>

        {/* Participants */}
        <ParticipantAvatars participants={participants} />
      </div>
    </div>
  );
}
