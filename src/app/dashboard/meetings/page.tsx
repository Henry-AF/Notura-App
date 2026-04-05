"use client";

import React, { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, RefreshCw, Sparkles, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { formatRelativeTime } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

type Status = "completed" | "processing" | "failed";

interface Meeting {
  id: string;
  clientName: string;
  title: string;
  date: string;
  rawDate: string;
  status: Status;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const AVATAR_COLORS: Record<string, { bg: string; color: string }> = {
  A: { bg: "#1A2E4A", color: "#74C0FC" },
  N: { bg: "#1A1A3A", color: "#A29BFE" },
  H: { bg: "#2E1A1A", color: "#FF8A8A" },
};

function getAvatarStyle(name: string) {
  const initial = name.trim()[0]?.toUpperCase() ?? "?";
  if (AVATAR_COLORS[initial]) return AVATAR_COLORS[initial];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  const hue = Math.abs(hash) % 360;
  return { bg: `hsl(${hue},30%,18%)`, color: `hsl(${hue},80%,70%)` };
}

const STATUS_MAP = {
  completed: { dot: "#4ECB71", label: "Concluído", bg: "rgba(78,203,113,0.1)", color: "#4ECB71" },
  processing: { dot: "#74C0FC", label: "Processando", bg: "rgba(116,192,252,0.1)", color: "#74C0FC" },
  failed: { dot: "#FF6B6B", label: "Falhou", bg: "rgba(255,107,107,0.1)", color: "#FF6B6B" },
} as const;

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: Status }) {
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
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: s.dot, flexShrink: 0 }} />
      {s.label}
    </span>
  );
}

function MeetingRow({
  meeting,
  onRetry,
  onViewProcessing,
  onClick,
}: {
  meeting: Meeting;
  onRetry: (id: string) => void;
  onViewProcessing: (id: string) => void;
  onClick: (id: string) => void;
}) {
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
        gridTemplateColumns: "1fr 140px 150px 60px",
        padding: "14px 12px",
        borderRadius: "8px",
        alignItems: "center",
        cursor: "pointer",
        transition: "background 0.15s",
      }}
      onMouseEnter={(e) => ((e.currentTarget as HTMLDivElement).style.background = "#242424")}
      onMouseLeave={(e) => ((e.currentTarget as HTMLDivElement).style.background = "transparent")}
    >
      {/* Client + title */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
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
        <div style={{ minWidth: 0 }}>
          <p style={{ fontFamily: "Inter, sans-serif", fontWeight: 600, fontSize: "14px", color: "#FFFFFF", margin: 0 }}>
            {meeting.clientName}
          </p>
          <p
            style={{
              fontFamily: "Inter, sans-serif",
              fontWeight: 400,
              fontSize: "12px",
              color: "#606060",
              margin: 0,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
              maxWidth: "240px",
            }}
          >
            {meeting.title}
          </p>
        </div>
      </div>

      {/* Date */}
      <p style={{ fontFamily: "Inter, sans-serif", fontSize: "13px", color: "#A0A0A0", margin: 0 }}>
        {meeting.date}
      </p>

      {/* Status */}
      <div>
        <StatusBadge status={meeting.status} />
      </div>

      {/* Actions */}
      <div
        style={{ display: "flex", alignItems: "center", justifyContent: "flex-end" }}
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
              background: "#242424",
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
              background: "#2E1A1A",
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

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function MeetingsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<Status | "all">("all");

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from("meetings")
        .select("id, title, client_name, status, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      const mapped: Meeting[] = (data ?? []).map((m) => {
        const uiStatus: Status =
          m.status === "completed" ? "completed" : m.status === "failed" ? "failed" : "processing";
        return {
          id: m.id,
          clientName: m.client_name ?? m.title ?? "—",
          title: m.title ?? "—",
          date: formatRelativeTime(m.created_at),
          rawDate: m.created_at,
          status: uiStatus,
        };
      });

      setMeetings(mapped);
      setLoading(false);
    }
    load();
  }, []);

  const handleRetry = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/meetings/${id}/retry`, { method: "POST" });
      if (!res.ok) throw new Error();
      setMeetings((prev) =>
        prev.map((m) => (m.id === id ? { ...m, status: "processing" as const } : m))
      );
    } catch {
      // silently ignore
    }
  }, []);

  const filtered = meetings.filter((m) => {
    const q = search.toLowerCase();
    const matchesSearch =
      !q ||
      m.clientName.toLowerCase().includes(q) ||
      m.title.toLowerCase().includes(q) ||
      m.date.toLowerCase().includes(q);
    const matchesStatus = statusFilter === "all" || m.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const STATUS_OPTIONS: { value: Status | "all"; label: string }[] = [
    { value: "all", label: "Todos" },
    { value: "completed", label: "Concluído" },
    { value: "processing", label: "Processando" },
    { value: "failed", label: "Falhou" },
  ];

  return (
    <div>
      {/* Page header */}
      <div style={{ marginBottom: 24 }}>
        <h1
          style={{
            fontFamily: "'Plus Jakarta Sans', sans-serif",
            fontWeight: 700,
            fontSize: "26px",
            color: "#FFFFFF",
            margin: 0,
          }}
        >
          Reuniões
        </h1>
        <p style={{ fontFamily: "Inter, sans-serif", fontSize: "14px", color: "#606060", marginTop: 4 }}>
          {loading ? "Carregando..." : `${meetings.length} reunião${meetings.length !== 1 ? "ões" : ""} no total`}
        </p>
      </div>

      {/* Filters */}
      <div
        style={{
          display: "flex",
          gap: 12,
          marginBottom: 20,
          flexWrap: "wrap",
          alignItems: "center",
        }}
      >
        {/* Search input */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            background: "#1C1C1C",
            border: "1px solid #2E2E2E",
            borderRadius: "10px",
            padding: "10px 14px",
            flex: "1 1 260px",
            maxWidth: 400,
          }}
        >
          <Search style={{ width: 15, height: 15, color: "#606060", flexShrink: 0 }} />
          <input
            type="text"
            placeholder="Buscar por cliente ou título..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              background: "none",
              border: "none",
              outline: "none",
              fontFamily: "Inter, sans-serif",
              fontSize: "14px",
              color: "#FFFFFF",
              width: "100%",
            }}
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              style={{ background: "none", border: "none", cursor: "pointer", padding: 0, display: "flex" }}
            >
              <X style={{ width: 14, height: 14, color: "#606060" }} />
            </button>
          )}
        </div>

        {/* Status filter pills */}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {STATUS_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setStatusFilter(opt.value)}
              style={{
                padding: "8px 16px",
                borderRadius: "999px",
                border: "1px solid",
                borderColor: statusFilter === opt.value ? "#6C5CE7" : "#2E2E2E",
                background: statusFilter === opt.value ? "rgba(108,92,231,0.15)" : "transparent",
                color: statusFilter === opt.value ? "#A29BFE" : "#A0A0A0",
                fontFamily: "Inter, sans-serif",
                fontSize: "13px",
                fontWeight: statusFilter === opt.value ? 600 : 400,
                cursor: "pointer",
                transition: "all 0.15s",
                whiteSpace: "nowrap",
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div
        style={{
          background: "#1C1C1C",
          border: "1px solid #2E2E2E",
          borderRadius: "14px",
          padding: "20px",
        }}
      >
        {/* Table header */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 140px 150px 60px",
            padding: "0 12px 10px",
            borderBottom: "1px solid #2E2E2E",
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
                color: "#606060",
                margin: 0,
              }}
            >
              {col}
            </p>
          ))}
        </div>

        {/* Loading */}
        {loading && (
          <div style={{ display: "flex", justifyContent: "center", padding: "48px 0" }}>
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: "50%",
                border: "2px solid #6C5CE7",
                borderTopColor: "transparent",
                animation: "spin 0.7s linear infinite",
              }}
            />
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          </div>
        )}

        {/* Empty state */}
        {!loading && filtered.length === 0 && (
          <div style={{ textAlign: "center", padding: "48px 0" }}>
            <p style={{ fontFamily: "Inter, sans-serif", fontSize: "14px", color: "#606060" }}>
              {search || statusFilter !== "all"
                ? "Nenhuma reunião encontrada com os filtros aplicados."
                : "Nenhuma reunião ainda."}
            </p>
          </div>
        )}

        {/* Rows */}
        {!loading &&
          filtered.map((m) => (
            <MeetingRow
              key={m.id}
              meeting={m}
              onRetry={handleRetry}
              onViewProcessing={(id) => router.push(`/dashboard/meetings/${id}`)}
              onClick={(id) => router.push(`/dashboard/meetings/${id}`)}
            />
          ))}
      </div>
    </div>
  );
}
