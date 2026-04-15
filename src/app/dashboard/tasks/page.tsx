"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { KanbanBoard, TaskEditModal } from "@/components/tasks";
import { PageHeader } from "@/components/ui/app";
import { useKanban } from "@/hooks/useKanban";
import type { Column, Task } from "@/components/tasks";
import type { DropResult } from "@hello-pangea/dnd";
import {
  SlidersHorizontal,
  ArrowUpDown,
  Check,
  MoreHorizontal,
  ChevronRight,
} from "lucide-react";
import {
  createTask,
  deleteTaskById,
  fetchTaskBoardData,
  type TaskMeetingOption,
  updateTaskById,
} from "./tasks-api";

// Column definitions (no tasks)
const COLUMN_DEFS: Omit<Column, "tasks">[] = [
  {
    id: "todo",
    title: "A Fazer",
    dotColor: "#6C5CE7",
    badgeColor: "#A29BFE",
    badgeBg: "rgba(108,92,231,0.15)",
  },
  {
    id: "in_progress",
    title: "Em Andamento",
    dotColor: "#FFA94D",
    badgeColor: "#FFA94D",
    badgeBg: "rgba(255,169,77,0.15)",
  },
  {
    id: "completed",
    title: "Concluído",
    dotColor: "#4ECB71",
    badgeColor: "#4ECB71",
    badgeBg: "rgba(78,203,113,0.15)",
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

type TaskStatus = "todo" | "in_progress" | "completed";

function toTaskStatus(columnId: string): TaskStatus {
  if (columnId === "in_progress") return "in_progress";
  if (columnId === "completed" || columnId === "done") return "completed";
  return "todo";
}

function getProgress(columnId: string): number {
  if (columnId === "completed") return 100;
  if (columnId === "in_progress") return 50;
  return 10;
}

function parseDueDate(dueDate: string | undefined): Date | null {
  if (!dueDate) return null;
  const d = new Date(dueDate);
  return isNaN(d.getTime()) ? null : d;
}

function getDueDateInfo(dueDate: string | undefined): {
  label: string;
  color: string;
  bg: string;
} | null {
  const due = parseDueDate(dueDate);
  if (!due) return null;
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dueDay = new Date(due.getFullYear(), due.getMonth(), due.getDate());
  const diffDays = Math.round((dueDay.getTime() - today.getTime()) / 86400000);
  if (diffDays < 0)
    return { label: "ATRASADO", color: "#FF6B6B", bg: "rgba(255,107,107,0.12)" };
  if (diffDays === 0)
    return { label: "HOJE", color: "#FFA94D", bg: "rgba(255,169,77,0.12)" };
  return {
    label: `${diffDays} DIA${diffDays !== 1 ? "S" : ""} RESTANTES`,
    color: "#606060",
    bg: "transparent",
  };
}

function formatDate(dueDate: string | undefined): string {
  const due = parseDueDate(dueDate);
  if (!due) return "—";
  return due.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
}

function nameToInitials(name: string): string {
  return name
    .split(" ")
    .slice(0, 2)
    .map((n) => n[0])
    .join("")
    .toUpperCase();
}

function getAvatarBg(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue},60%,45%)`;
}

// ─── Loading ──────────────────────────────────────────────────────────────────

function LoadingState() {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 240 }}>
      <div
        style={{
          width: 36, height: 36, borderRadius: "50%",
          border: "2px solid #6C5CE7", borderTopColor: "transparent",
          animation: "spin 0.7s linear infinite",
        }}
      />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

// ─── Productivity Pulse ───────────────────────────────────────────────────────

function ProductivityPulse({ columns }: { columns: Column[] }) {
  const allTasks = columns.flatMap((c) => c.tasks);
  const total = allTasks.length;
  const done = allTasks.filter((t) => t.columnId === "completed").length;
  const pct = total === 0 ? 0 : Math.round((done / total) * 100);

  return (
    <div
      style={{
        background: "rgb(var(--cn-card))",
        border: "1px solid rgb(var(--cn-border))",
        borderRadius: 16,
        padding: "24px 28px",
        flex: "1 1 260px",
      }}
    >
      <p
        style={{
          fontFamily: "Inter, sans-serif",
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          color: "#6C5CE7",
          margin: "0 0 10px",
        }}
      >
        Pulso de Produtividade
      </p>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
        <span
          style={{
            fontFamily: "'Plus Jakarta Sans', sans-serif",
            fontWeight: 800,
            fontSize: 40,
            color: "rgb(var(--cn-ink))",
          }}
        >
          {pct}%
        </span>
        <span style={{ fontFamily: "Inter, sans-serif", fontSize: 13, color: "#4ECB71", fontWeight: 600 }}>
          {done}/{total} concluídas
        </span>
      </div>
      <p
        style={{
          fontFamily: "Inter, sans-serif",
          fontSize: 13,
          color: "rgb(var(--cn-muted))",
          marginTop: 8,
        }}
      >
        {pct >= 80
          ? "Excelente ritmo! Continue assim. 🚀"
          : pct >= 50
          ? "Bom progresso. Foco nas entregas restantes."
          : "Sua equipe está avançando. Vamos lá!"}
      </p>
    </div>
  );
}

// ─── Upcoming Deadlines ───────────────────────────────────────────────────────

const DEADLINE_ICONS: Record<number, string> = { 0: "⏰", 1: "📅", 2: "🏁" };

function UpcomingDeadlines({ columns }: { columns: Column[] }) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const next7Days = new Date(today);
  next7Days.setDate(next7Days.getDate() + 7);

  const upcoming = columns
    .flatMap((c) => c.tasks)
    .filter((t) => t.columnId !== "completed" && t.dueDate)
    .map((t) => ({ task: t, due: parseDueDate(t.dueDate) }))
    .filter(({ due }) => due && due >= today && due <= next7Days)
    .sort((a, b) => a.due!.getTime() - b.due!.getTime())
    .slice(0, 3);

  if (upcoming.length === 0) {
    return (
      <div
        style={{
          background: "rgb(var(--cn-card))",
          border: "1px solid rgb(var(--cn-border))",
          borderRadius: 16,
          padding: "24px 28px",
          flex: "2 1 400px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <p style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 700, fontSize: 17, color: "rgb(var(--cn-ink))", margin: 0 }}>
            Prazos Próximos
          </p>
        </div>
        <p style={{ fontFamily: "Inter, sans-serif", fontSize: 14, color: "rgb(var(--cn-muted))" }}>
          Nenhum prazo próximo. 🎉
        </p>
      </div>
    );
  }

  return (
    <div
      style={{
        background: "rgb(var(--cn-card))",
        border: "1px solid rgb(var(--cn-border))",
        borderRadius: 16,
        padding: "24px 28px",
        flex: "2 1 400px",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <p style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 700, fontSize: 17, color: "rgb(var(--cn-ink))", margin: 0 }}>
          Prazos Próximos
        </p>
        <button
          style={{
            background: "none", border: "none", cursor: "pointer",
            fontFamily: "Inter, sans-serif", fontSize: 13, color: "#6C5CE7", fontWeight: 600,
            display: "flex", alignItems: "center", gap: 4,
          }}
        >
          Ver todos <ChevronRight style={{ width: 14, height: 14 }} />
        </button>
      </div>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        {upcoming.map(({ task, due }, idx) => {
          const diffDays = Math.round((due!.getTime() - today.getTime()) / 86400000);
          const timeStr = diffDays === 0 ? "Hoje" : `${due!.toLocaleDateString("pt-BR", { weekday: "short" })}, ${due!.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}`;
          return (
            <div
              key={task.id}
              style={{
                flex: "1 1 120px",
                background: "rgb(var(--cn-card2))",
                borderRadius: 12,
                padding: "14px 16px",
                display: "flex",
                flexDirection: "column",
                gap: 6,
              }}
            >
              <div
                style={{
                  width: 32, height: 32, borderRadius: 8,
                  background: "rgba(108,92,231,0.15)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 16,
                }}
              >
                {DEADLINE_ICONS[idx] ?? "📌"}
              </div>
              <p
                style={{
                  fontFamily: "Inter, sans-serif", fontWeight: 600, fontSize: 13,
                  color: "rgb(var(--cn-ink))", margin: 0,
                  whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                }}
              >
                {task.title}
              </p>
              <p style={{ fontFamily: "Inter, sans-serif", fontSize: 11, color: "rgb(var(--cn-muted))", margin: 0 }}>
                {timeStr}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Skeleton row ────────────────────────────────────────────────────────────

function SkeletonRow() {
  return (
    <tr style={{ borderBottom: "1px solid rgb(var(--cn-border))" }}>
      <td style={{ padding: "14px 8px 14px 16px", width: 36 }}>
        <div style={{ width: 18, height: 18, borderRadius: 4, background: "rgb(var(--cn-card2))", animation: "shimmer 1.5s ease-in-out infinite" }} />
      </td>
      {([180, 80, 60, 90] as const).map((w, i) => (
        <td key={i} style={{ padding: "14px 12px" }}>
          <div style={{ width: w, height: 13, borderRadius: 4, background: "rgb(var(--cn-card2))", animation: "shimmer 1.5s ease-in-out infinite", animationDelay: `${i * 0.1}s` }} />
        </td>
      ))}
      <td style={{ padding: "14px 12px" }}>
        <div style={{ width: 10, height: 10, borderRadius: "50%", background: "rgb(var(--cn-card2))", animation: "shimmer 1.5s ease-in-out infinite" }} />
      </td>
      <td />
    </tr>
  );
}

// ─── Task Row (List view) ─────────────────────────────────────────────────────

function TaskRow({
  task,
  meetings,
  onToggleDone,
  onEdit,
  onDelete,
}: {
  task: Task;
  meetings: TaskMeetingOption[];
  onToggleDone: (task: Task) => void;
  onEdit: (task: Task) => void;
  onDelete: (id: string) => void;
}) {
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showMenu) return;
    function handle(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setShowMenu(false);
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [showMenu]);

  const dueDateInfo = getDueDateInfo(task.dueDate);
  const assigneeName = task.assignees?.[0]?.name ?? task.assignee?.name ?? "";
  const meeting = meetings.find((m) => m.id === task.meetingId);

  const priorityColors: Record<string, string> = {
    alta: "#FF6B6B",
    media: "#FFA94D",
    baixa: "#4ECB71",
  };

  return (
    <tr
      style={{ borderBottom: "1px solid rgb(var(--cn-border))", transition: "background 0.15s", cursor: "pointer" }}
      onMouseEnter={(e) => ((e.currentTarget as HTMLTableRowElement).style.background = "rgb(var(--cn-card2))")}
      onMouseLeave={(e) => ((e.currentTarget as HTMLTableRowElement).style.background = "transparent")}
      onClick={() => onEdit(task)}
    >
      {/* Checkbox */}
      <td style={{ padding: "14px 8px 14px 16px", width: 36 }} onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          onClick={() => onToggleDone(task)}
          style={{
            width: 18, height: 18, borderRadius: 4, flexShrink: 0,
            border: task.columnId === "completed" ? "none" : "1.5px solid rgb(var(--cn-border))",
            background: task.columnId === "completed" ? "#4ECB71" : "transparent",
            cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
            transition: "all 0.15s",
          }}
        >
          {task.columnId === "completed" && <Check style={{ width: 10, height: 10, color: "#fff" }} />}
        </button>
      </td>

      {/* Task name */}
      <td style={{ padding: "14px 12px", minWidth: 160 }}>
        <span
          style={{
            fontFamily: "Inter, sans-serif", fontWeight: 600, fontSize: 14,
            color: task.columnId === "completed" ? "rgb(var(--cn-muted))" : "rgb(var(--cn-ink))",
            textDecoration: task.columnId === "completed" ? "line-through" : "none",
          }}
        >
          {task.title}
        </span>
      </td>

      {/* Due date */}
      <td style={{ padding: "14px 12px", minWidth: 130 }}>
        <div>
          <p style={{ fontFamily: "Inter, sans-serif", fontSize: 13, color: "rgb(var(--cn-ink2))", margin: 0 }}>
            {formatDate(task.dueDate)}
          </p>
          {dueDateInfo && (
            <span
              style={{
                fontFamily: "Inter, sans-serif", fontSize: 10, fontWeight: 700,
                color: dueDateInfo.color, background: dueDateInfo.bg,
                padding: dueDateInfo.bg !== "transparent" ? "1px 6px" : 0,
                borderRadius: 4, display: "inline-block", marginTop: 2,
                letterSpacing: "0.04em",
              }}
            >
              {dueDateInfo.label}
            </span>
          )}
        </div>
      </td>

      {/* Responsible */}
      <td style={{ padding: "14px 12px" }}>
        {assigneeName ? (
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div
              style={{
                width: 26, height: 26, borderRadius: "50%",
                background: getAvatarBg(assigneeName),
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 10, fontWeight: 700, color: "#fff", flexShrink: 0,
              }}
            >
              {nameToInitials(assigneeName)}
            </div>
            <span style={{ fontFamily: "Inter, sans-serif", fontSize: 13, color: "rgb(var(--cn-ink2))" }}>
              {assigneeName}
            </span>
          </div>
        ) : (
          <span style={{ fontFamily: "Inter, sans-serif", fontSize: 13, color: "rgb(var(--cn-muted))" }}>—</span>
        )}
      </td>

      {/* Meeting */}
      <td style={{ padding: "14px 12px" }}>
        {meeting ? (
          <span
            style={{
              fontFamily: "Inter, sans-serif", fontSize: 12, fontWeight: 500,
              background: "rgba(108,92,231,0.12)", color: "#6C5CE7",
              padding: "3px 8px", borderRadius: 6, whiteSpace: "nowrap",
            }}
          >
            {meeting.clientName || meeting.title}
          </span>
        ) : (
          <span style={{ fontFamily: "Inter, sans-serif", fontSize: 13, color: "rgb(var(--cn-muted))" }}>—</span>
        )}
      </td>

      {/* Tags (priority as colored dot) */}
      <td style={{ padding: "14px 12px" }}>
        <div style={{ display: "flex", gap: 5, alignItems: "center" }}>
          <div
            style={{
              width: 10, height: 10, borderRadius: "50%",
              background: priorityColors[task.priority] ?? "rgb(var(--cn-muted))",
            }}
          />
          {task.priority === "alta" && (
            <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#FFA94D" }} />
          )}
        </div>
      </td>

      {/* Actions */}
      <td style={{ padding: "14px 8px 14px 4px", width: 40 }} onClick={(e) => e.stopPropagation()}>
        <div style={{ position: "relative" }} ref={menuRef}>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setShowMenu((v) => !v); }}
            style={{
              width: 28, height: 28, borderRadius: 6, border: "none",
              background: "transparent", cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
              color: "rgb(var(--cn-muted))", transition: "all 0.15s",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = "rgb(var(--cn-card2))";
              (e.currentTarget as HTMLButtonElement).style.color = "rgb(var(--cn-ink))";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = "transparent";
              (e.currentTarget as HTMLButtonElement).style.color = "rgb(var(--cn-muted))";
            }}
          >
            <MoreHorizontal style={{ width: 16, height: 16 }} />
          </button>

          {showMenu && (
            <div
              style={{
                position: "absolute", top: 32, right: 0, zIndex: 100,
                background: "rgb(var(--cn-card))",
                border: "1px solid rgb(var(--cn-border))",
                borderRadius: 10, padding: 6, minWidth: 140,
                boxShadow: "0 8px 24px rgba(0,0,0,0.15)",
              }}
            >
              <button
                onClick={() => { setShowMenu(false); onEdit(task); }}
                style={{
                  width: "100%", padding: "8px 10px", borderRadius: 6,
                  border: "none", background: "transparent",
                  color: "rgb(var(--cn-ink2))", fontFamily: "Inter, sans-serif",
                  fontSize: 13, textAlign: "left", cursor: "pointer",
                }}
                onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.background = "rgb(var(--cn-card2))")}
                onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.background = "transparent")}
              >
                Editar tarefa
              </button>
              <button
                onClick={() => { setShowMenu(false); onDelete(task.id); }}
                style={{
                  width: "100%", padding: "8px 10px", borderRadius: 6,
                  border: "none", background: "transparent",
                  color: "#FF6B6B", fontFamily: "Inter, sans-serif",
                  fontSize: 13, textAlign: "left", cursor: "pointer",
                }}
                onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.background = "rgba(255,107,107,0.1)")}
                onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.background = "transparent")}
              >
                Excluir
              </button>
            </div>
          )}
        </div>
      </td>
    </tr>
  );
}

// ─── Workspace Tasks List ─────────────────────────────────────────────────────

function WorkspaceTasksList({
  columns,
  meetings,
  loading = false,
  onToggleDone,
  onEdit,
  onDelete,
}: {
  columns: Column[];
  meetings: TaskMeetingOption[];
  loading?: boolean;
  onToggleDone: (task: Task) => void;
  onEdit: (task: Task) => void;
  onDelete: (id: string) => void;
}) {
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<"dueDate" | "priority" | "progress">("dueDate");
  const [filterStatus, setFilterStatus] = useState<"all" | "todo" | "in_progress" | "completed">("all");
  const [showFilters, setShowFilters] = useState(false);

  const allTasks = columns.flatMap((c) => c.tasks);
  const activeToday = allTasks.filter((t) => t.columnId !== "completed").length;

  const filtered = allTasks
    .filter((t) => {
      if (filterStatus !== "all" && t.columnId !== filterStatus) return false;
      if (search && !t.title.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    })
    .sort((a, b) => {
      if (sortBy === "priority") {
        const order = { alta: 0, media: 1, baixa: 2 };
        return (order[a.priority] ?? 1) - (order[b.priority] ?? 1);
      }
      if (sortBy === "progress") {
        return getProgress(b.columnId) - getProgress(a.columnId);
      }
      // dueDate
      const da = parseDueDate(a.dueDate);
      const db = parseDueDate(b.dueDate);
      if (!da && !db) return 0;
      if (!da) return 1;
      if (!db) return -1;
      return da.getTime() - db.getTime();
    });

  const COL_HEADERS = [
    { key: "task", label: "TAREFA" },
    { key: "due", label: "PRAZO" },
    { key: "responsible", label: "RESPONSÁVEL" },
    { key: "meeting", label: "REUNIÃO" },
    { key: "tags", label: "PRIORIDADE" },
    { key: "actions", label: "" },
  ];

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <PageHeader
          breadcrumbs={[
            { label: "Dashboard", href: "/dashboard" },
            { label: "Tarefas" },
          ]}
          title="Tarefas do Workspace"
          description={
            <>
              <span
                style={{
                  display: "inline-block",
                  width: 7,
                  height: 7,
                  borderRadius: "50%",
                  background: "#6C5CE7",
                  marginRight: 6,
                  verticalAlign: "middle",
                }}
              />
              Você tem{" "}
              <strong style={{ color: "rgb(var(--cn-ink2))" }}>
                {activeToday} tarefa{activeToday !== 1 ? "s" : ""} ativa
                {activeToday !== 1 ? "s" : ""}
              </strong>{" "}
              hoje
            </>
          }
          descriptionClassName="max-w-none"
        />

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "flex-end",
            flexWrap: "wrap",
            gap: 12,
            marginTop: 24,
          }}
        >
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            {/* Search */}
            <input
              type="text"
              placeholder="Buscar tarefas..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                background: "rgb(var(--cn-input-bg))",
                border: "1px solid rgb(var(--cn-input-border))",
                borderRadius: 10,
                padding: "8px 14px",
                fontFamily: "Inter, sans-serif",
                fontSize: 13,
                color: "rgb(var(--cn-ink))",
                outline: "none",
                width: 200,
              }}
            />

            {/* Filters btn */}
            <button
              type="button"
              onClick={() => setShowFilters((v) => !v)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "8px 14px",
                borderRadius: 10,
                border: "1px solid rgb(var(--cn-border))",
                background: showFilters ? "rgba(108,92,231,0.1)" : "rgb(var(--cn-card))",
                color: showFilters ? "#6C5CE7" : "rgb(var(--cn-ink2))",
                fontFamily: "Inter, sans-serif",
                fontSize: 13,
                fontWeight: 500,
                cursor: "pointer",
                transition: "all 0.15s",
              }}
            >
              <SlidersHorizontal style={{ width: 14, height: 14 }} />
              Filtros
            </button>

            {/* Sort By btn */}
            <div style={{ position: "relative" }}>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "8px 14px",
                  paddingRight: 32,
                  borderRadius: 10,
                  border: "1px solid rgb(var(--cn-border))",
                  background: "rgb(var(--cn-card))",
                  color: "rgb(var(--cn-ink2))",
                  fontFamily: "Inter, sans-serif",
                  fontSize: 13,
                  fontWeight: 500,
                  cursor: "pointer",
                  outline: "none",
                  appearance: "none",
                }}
              >
                <option value="dueDate">Ordenar: Prazo</option>
                <option value="priority">Ordenar: Prioridade</option>
              </select>
              <ArrowUpDown
                style={{
                  position: "absolute",
                  right: 10,
                  top: "50%",
                  transform: "translateY(-50%)",
                  width: 12,
                  height: 12,
                  color: "rgb(var(--cn-muted))",
                  pointerEvents: "none",
                }}
              />
            </div>
          </div>
        </div>

        {/* Filter pills (expandable) */}
        {showFilters && (
          <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
            {(["all", "todo", "in_progress", "completed"] as const).map((s) => {
              const labels = { all: "Todas", todo: "A Fazer", in_progress: "Em Andamento", completed: "Concluídas" };
              const active = filterStatus === s;
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => setFilterStatus(s)}
                  style={{
                    padding: "5px 14px", borderRadius: 999,
                    border: `1px solid ${active ? "#6C5CE7" : "rgb(var(--cn-border))"}`,
                    background: active ? "rgba(108,92,231,0.12)" : "transparent",
                    color: active ? "#6C5CE7" : "rgb(var(--cn-ink2))",
                    fontFamily: "Inter, sans-serif", fontSize: 13, fontWeight: 500,
                    cursor: "pointer", transition: "all 0.15s",
                  }}
                >
                  {labels[s]}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Table */}
      <div
        style={{
          background: "rgb(var(--cn-card))",
          border: "1px solid rgb(var(--cn-border))",
          borderRadius: 16, overflow: "hidden",
        }}
      >
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid rgb(var(--cn-border))" }}>
                <th style={{ width: 36, padding: "10px 8px 10px 16px" }} />
                {COL_HEADERS.map((h) => (
                  <th
                    key={h.key}
                    style={{
                      padding: "10px 12px", textAlign: "left",
                      fontFamily: "Inter, sans-serif", fontWeight: 600,
                      fontSize: 11, color: "rgb(var(--cn-muted))",
                      textTransform: "uppercase", letterSpacing: "0.07em",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {h.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 6 }).map((_, i) => <SkeletonRow key={i} />)
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ padding: "40px 20px", textAlign: "center", fontFamily: "Inter, sans-serif", fontSize: 14, color: "rgb(var(--cn-muted))" }}>
                    {search ? "Nenhuma tarefa encontrada." : "Nenhuma tarefa ainda."}
                  </td>
                </tr>
              ) : (
                filtered.map((task) => (
                  <TaskRow
                    key={task.id}
                    task={task}
                    meetings={meetings}
                    onToggleDone={onToggleDone}
                    onEdit={onEdit}
                    onDelete={onDelete}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Bottom cards */}
      <div style={{ display: "flex", gap: 16, marginTop: 20, flexWrap: "wrap" }}>
        <ProductivityPulse columns={columns} />
        <UpcomingDeadlines columns={columns} />
      </div>
    </div>
  );
}

export default function TasksPage() {
  const [tab, setTab] = useState<"lista" | "prazo">("lista");
  const [initialColumns, setInitialColumns] = useState<Column[] | null>(null);
  const [meetings, setMeetings] = useState<TaskMeetingOption[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const addTaskFnRef = useRef<((columnId: string) => void) | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const data = await fetchTaskBoardData();
        setInitialColumns(data.columns);
        setMeetings(data.meetings);
      } catch {
        setInitialColumns(COLUMN_DEFS.map((def) => ({ ...def, tasks: [] })));
        setMeetings([]);
      } finally {
        setLoadingData(false);
      }
    }
    load();
  }, []);

  if (!initialColumns) return <LoadingState />;

  return (
    <TasksPageContent
      tab={tab}
      onTabChange={setTab}
      initialColumns={initialColumns}
      meetings={meetings}
      addTaskFnRef={addTaskFnRef}
      loading={loadingData}
    />
  );
}

// ─── Custom column localStorage helpers ──────────────────────────────────────

const CUSTOM_COLS_KEY = "notura-custom-columns";

type CustomColMeta = { id: string; title: string; dotColor: string; badgeColor: string; badgeBg: string };

function loadCustomCols(): CustomColMeta[] {
  if (typeof window === "undefined") return [];
  try { return JSON.parse(localStorage.getItem(CUSTOM_COLS_KEY) ?? "[]"); } catch { return []; }
}

function saveCustomCols(cols: Column[]) {
  const custom = cols.filter((c) => !["todo", "in_progress", "completed"].includes(c.id));
  localStorage.setItem(CUSTOM_COLS_KEY, JSON.stringify(custom.map(({ id, title, dotColor, badgeColor, badgeBg }) => ({ id, title, dotColor, badgeColor, badgeBg }))));
}

// ─── Combined content (shared state) ─────────────────────────────────────────

function TasksPageContent({
  tab,
  onTabChange,
  initialColumns,
  meetings,
  addTaskFnRef,
  loading,
}: {
  tab: "lista" | "prazo";
  onTabChange: (t: "lista" | "prazo") => void;
  initialColumns: Column[];
  meetings: TaskMeetingOption[];
  addTaskFnRef: React.MutableRefObject<((columnId: string) => void) | null>;
  loading: boolean;
}) {
  // Merge server columns with any custom columns stored in localStorage
  const mergedInitial = React.useMemo(() => {
    const customCols = loadCustomCols();
    const existing = new Set(initialColumns.map((c) => c.id));
    const extra = customCols
      .filter((cc) => !existing.has(cc.id))
      .map((cc) => ({ ...cc, tasks: [] as Task[] }));
    return [...initialColumns, ...extra];
  }, [initialColumns]);

  const { columns, handleDragEnd, addTask, updateTask, deleteTask, addColumn: addColBase, removeColumn: removeColBase, renameColumn: renameColBase, resetColumns } =
    useKanban(mergedInitial);

  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [draftColumnId, setDraftColumnId] = useState<string | null>(null);
  const [dragError, setDragError] = useState<string | null>(null);

  function isDraftTask(taskId: string) {
    return taskId.startsWith("task-");
  }

  // Wrap column operations to persist custom columns to localStorage
  const addColumn = useCallback((title: string) => {
    addColBase(title);
    // Save after state update (columns hasn't changed yet here, so use timeout)
    setTimeout(() => saveCustomCols(columns), 50);
  }, [addColBase, columns]);

  const removeColumn = useCallback((columnId: string) => {
    removeColBase(columnId);
    setTimeout(() => saveCustomCols(columns.filter((c) => c.id !== columnId)), 50);
  }, [removeColBase, columns]);

  const renameColumn = useCallback((columnId: string, newTitle: string) => {
    renameColBase(columnId, newTitle);
    setTimeout(() => saveCustomCols(columns.map((c) => c.id === columnId ? { ...c, title: newTitle } : c)), 50);
  }, [renameColBase, columns]);

  const handleDragEndWithPersist = useCallback(
    async (result: DropResult) => {
      const { destination, source, type } = result;
      if (type === "COLUMN") {
        handleDragEnd(result);
        setTimeout(() => saveCustomCols(columns), 50);
        return;
      }
      const srcColumn = columns.find((c) => c.id === source.droppableId);
      const movedTask = srcColumn?.tasks[source.index];
      if (!destination || destination.droppableId === source.droppableId || !movedTask) return;
      if (isDraftTask(movedTask.id)) return;
      // Capture snapshot before optimistic update for potential revert
      const snapshot = columns.map((c) => ({ ...c, tasks: [...c.tasks] }));
      handleDragEnd(result);
      try {
        await updateTaskById(movedTask.id, { status: toTaskStatus(destination.droppableId) });
      } catch {
        resetColumns(snapshot);
        setDragError("Falha ao mover tarefa. Tente novamente.");
        setTimeout(() => setDragError(null), 4000);
      }
    },
    [handleDragEnd, columns, resetColumns]
  );

  useEffect(() => {
    addTaskFnRef.current = handleAddTask;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleAddTask(columnId: string) {
    setDraftColumnId(columnId);
    setEditingTask({
      id: `task-${Date.now()}`,
      title: "Nova tarefa",
      priority: "media",
      columnId,
    });
  }

  async function handleSaveTask(id: string, updates: Partial<Task>) {
    const assigneeName = updates.assignees?.[0]?.name ?? updates.assignee?.name ?? null;
    if (isDraftTask(id)) {
      const columnId = draftColumnId ?? editingTask?.columnId ?? "todo";
      const createdTask = await createTask({
        title: updates.title ?? editingTask?.title ?? "Nova tarefa",
        priority: updates.priority ?? editingTask?.priority ?? "media",
        dueDate: updates.dueDate ?? editingTask?.dueDate,
        assigneeName: assigneeName ?? undefined,
        columnId,
        meetingId: updates.meetingId ?? editingTask?.meetingId ?? meetings[0]?.id ?? "",
      });
      addTask(createdTask.columnId, createdTask);
      setDraftColumnId(null);
      return;
    }
    updateTask(id, updates);
    const persistedTask = await updateTaskById(id, {
      title: updates.title,
      priority: updates.priority,
      dueDate: updates.dueDate,
      assigneeName,
    });
    updateTask(id, persistedTask);
  }

  async function handleDeleteTask(id: string) {
    if (isDraftTask(id)) { setDraftColumnId(null); return; }
    deleteTask(id);
    await deleteTaskById(id);
  }

  async function handleToggleDone(task: Task) {
    const newColumnId = task.columnId === "completed" ? "todo" : "completed";
    updateTask(task.id, { columnId: newColumnId });
    try {
      await updateTaskById(task.id, { status: toTaskStatus(newColumnId) });
    } catch {
      // Revert on failure
      updateTask(task.id, { columnId: task.columnId });
      setDragError("Falha ao atualizar tarefa. Tente novamente.");
      setTimeout(() => setDragError(null), 4000);
    }
  }

  return (
    <>
      <style>{`
        @keyframes fade-slide-up {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .task-card { animation: fade-slide-up 0.22s cubic-bezier(0.25,0.46,0.45,0.94) forwards; opacity: 0; }
        @keyframes shimmer { 0%,100% { opacity: 0.5; } 50% { opacity: 1; } }
      `}</style>

      {/* Tab switcher */}
      <div style={{ display: "flex", gap: 0, borderBottom: "1px solid rgb(var(--cn-border))", marginBottom: 28 }}>
        {(["lista", "prazo"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => onTabChange(t)}
            style={{
              padding: "10px 20px",
              fontFamily: "Inter, sans-serif", fontWeight: 600, fontSize: 14,
              color: tab === t ? "#6C5CE7" : "rgb(var(--cn-muted))",
              background: "none", border: "none", cursor: "pointer",
              borderBottom: tab === t ? "2px solid #6C5CE7" : "2px solid transparent",
              marginBottom: -1, transition: "all 0.15s", textTransform: "capitalize",
            }}
          >
            {t === "lista" ? "Lista" : "Prazo"}
          </button>
        ))}
        {/* Add task button */}
        <button
          type="button"
          onClick={() => handleAddTask("todo")}
          style={{
            marginLeft: "auto", display: "flex", alignItems: "center", gap: 6,
            padding: "6px 16px", borderRadius: 10,
            background: "#6C5CE7", color: "#fff",
            fontFamily: "Inter, sans-serif", fontWeight: 600, fontSize: 13,
            border: "none", cursor: "pointer", transition: "background 0.15s",
            alignSelf: "center", marginBottom: 8,
          }}
          onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.background = "#5A4BD1")}
          onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.background = "#6C5CE7")}
        >
          + Nova Tarefa
        </button>
      </div>

      {/* Tab content */}
      {tab === "lista" ? (
        <WorkspaceTasksList
          columns={columns}
          meetings={meetings}
          loading={loading}
          onToggleDone={handleToggleDone}
          onEdit={(task) => setEditingTask(task)}
          onDelete={handleDeleteTask}
        />
      ) : (
        <>
          {dragError && (
            <div
              style={{
                position: "fixed",
                bottom: 24,
                right: 24,
                zIndex: 9999,
                background: "#FF6B6B",
                color: "#fff",
                padding: "10px 18px",
                borderRadius: 10,
                fontFamily: "Inter, sans-serif",
                fontSize: 13,
                fontWeight: 600,
                boxShadow: "0 4px 16px rgba(255,107,107,0.35)",
                animation: "fade-slide-up 0.2s ease forwards",
              }}
            >
              {dragError}
            </div>
          )}
          <KanbanBoard
            columns={columns}
            onDragEnd={handleDragEndWithPersist}
            onAddTask={handleAddTask}
            onEditTask={(task) => setEditingTask(task)}
            onDeleteColumn={removeColumn}
            onAddColumn={addColumn}
            onRenameColumn={renameColumn}
          />
        </>
      )}

      {editingTask && (
        <TaskEditModal
          task={editingTask}
          meetings={meetings}
          onSave={handleSaveTask}
          onDelete={handleDeleteTask}
          onClose={() => { setEditingTask(null); setDraftColumnId(null); }}
        />
      )}
    </>
  );
}
