"use client";

import React, { useState, useEffect, useRef } from "react";
import { X, Plus, Trash2, Calendar, AlignLeft, Flag, User, Link2 } from "lucide-react";
import type { Task } from "./TaskCard";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TaskMeetingOption {
  id: string;
  label: string;
}

export interface TaskEditModalProps {
  task: Task;
  meetings?: TaskMeetingOption[];
  onSave: (id: string, updates: Partial<Task>) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const AVATAR_COLORS = [
  "#6C5CE7", "#00CEC9", "#FFA94D", "#FF6B6B",
  "#74C0FC", "#4ECB71", "#E91E8C", "#A29BFE",
];

function avatarColor(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function initials(name: string) {
  return name.trim().split(" ").filter(Boolean).slice(0, 2).map((n) => n[0]).join("").toUpperCase();
}

// ─── Modal ────────────────────────────────────────────────────────────────────

export function TaskEditModal({
  task,
  meetings = [],
  onSave,
  onDelete,
  onClose,
}: TaskEditModalProps) {
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description ?? "");
  const [priority, setPriority] = useState(task.priority);
  const [dueDate, setDueDate] = useState(task.dueDate ?? "");
  const [meetingId, setMeetingId] = useState(task.meetingId ?? meetings[0]?.id ?? "");
  const [assignees, setAssignees] = useState<{ name: string; avatarUrl?: string }[]>(
    task.assignees ?? (task.assignee ? [task.assignee] : [])
  );
  const [newName, setNewName] = useState("");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const titleRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    titleRef.current?.focus();
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  function handleSave() {
    const trimmed = title.trim();
    if (!trimmed || !meetingId) return;
    onSave(task.id, {
      title: trimmed,
      description: description.trim() || undefined,
      priority,
      dueDate: dueDate || undefined,
      meetingId,
      assignees: assignees.length > 0 ? assignees : undefined,
      assignee: assignees[0] ?? undefined,
    });
    onClose();
  }

  function addAssignee() {
    const name = newName.trim();
    if (!name) return;
    setAssignees((prev) => [...prev, { name }]);
    setNewName("");
  }

  function removeAssignee(i: number) {
    setAssignees((prev) => prev.filter((_, idx) => idx !== i));
  }

  const LABEL: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: 6,
    marginBottom: 6,
    fontSize: 11,
    fontWeight: 600,
    color: "rgb(var(--cn-muted))",
    textTransform: "uppercase",
    letterSpacing: "0.07em",
    fontFamily: "Inter, sans-serif",
  };

  const INPUT: React.CSSProperties = {
    width: "100%",
    background: "rgb(var(--cn-input-bg))",
    border: "1px solid rgb(var(--cn-input-border))",
    borderRadius: 8,
    padding: "9px 12px",
    color: "rgb(var(--cn-ink))",
    fontSize: 13,
    fontFamily: "Inter, sans-serif",
    outline: "none",
    boxSizing: "border-box",
    transition: "border-color 0.15s",
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 60,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
      }}
    >
      {/* Backdrop */}
      <div
        style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.65)", backdropFilter: "blur(4px)" }}
        onClick={onClose}
      />

      {/* Panel */}
      <div
        style={{
          position: "relative",
          zIndex: 10,
          width: "100%",
          maxWidth: 520,
          background: "rgb(var(--cn-card))",
          border: "1px solid rgb(var(--cn-border))",
          borderRadius: 16,
          boxShadow: "0 24px 64px rgba(0,0,0,0.6)",
          display: "flex",
          flexDirection: "column",
          maxHeight: "90vh",
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            padding: "16px 20px",
            borderBottom: "1px solid rgb(var(--cn-border))",
          }}
        >
          <h2
            style={{
              flex: 1,
              margin: 0,
              fontFamily: "Inter, sans-serif",
              fontWeight: 700,
              fontSize: 15,
              color: "rgb(var(--cn-ink))",
            }}
          >
            Editar tarefa
          </h2>
          <button
            onClick={onClose}
            aria-label="Fechar"
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "rgb(var(--cn-muted))",
              display: "flex",
              padding: 4,
              borderRadius: 6,
              transition: "color 0.15s",
            }}
            onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.color = "rgb(var(--cn-ink))")}
            onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.color = "rgb(var(--cn-muted))")}
          >
            <X style={{ width: 18, height: 18 }} />
          </button>
        </div>

        {/* Body — scrollable */}
        <div style={{ flex: 1, overflowY: "auto", padding: "20px 20px 4px" }}>
          {/* Title */}
          <div style={{ marginBottom: 16 }}>
            <label style={LABEL}>Título</label>
            <textarea
              ref={titleRef}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              rows={2}
              style={{ ...INPUT, fontWeight: 600, fontSize: 15, resize: "vertical" }}
              onFocus={(e) => (e.currentTarget.style.borderColor = "#6C5CE7")}
              onBlur={(e) => (e.currentTarget.style.borderColor = "rgb(var(--cn-input-border))")}
            />
          </div>

          {/* Description */}
          <div style={{ marginBottom: 16 }}>
            <label style={LABEL}>
              <AlignLeft style={{ width: 12, height: 12 }} />
              Descrição
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Descreva o que precisa ser feito..."
              rows={3}
              style={{ ...INPUT, resize: "vertical" }}
              onFocus={(e) => (e.currentTarget.style.borderColor = "#6C5CE7")}
              onBlur={(e) => (e.currentTarget.style.borderColor = "rgb(var(--cn-input-border))")}
            />
          </div>

          {/* Meeting */}
          <div style={{ marginBottom: 16 }}>
            <label style={LABEL}>
              <Link2 style={{ width: 12, height: 12 }} />
              Reunião
            </label>
            <select
              value={meetingId}
              onChange={(e) => setMeetingId(e.target.value)}
              disabled={meetings.length === 0}
              style={INPUT}
              onFocus={(e) => (e.currentTarget.style.borderColor = "#6C5CE7")}
              onBlur={(e) => (e.currentTarget.style.borderColor = "rgb(var(--cn-input-border))")}
            >
              {meetings.length === 0 ? (
                <option value="">Nenhuma reunião disponível</option>
              ) : (
                meetings.map((meeting) => (
                  <option key={meeting.id} value={meeting.id}>
                    {meeting.label}
                  </option>
                ))
              )}
            </select>
          </div>

          {/* Priority + Due date */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
            {/* Priority */}
            <div>
              <label style={LABEL}>
                <Flag style={{ width: 12, height: 12 }} />
                Prioridade
              </label>
              <div style={{ display: "flex", gap: 6 }}>
                {(["alta", "media", "baixa"] as const).map((p) => {
                  const isActive = priority === p;
                  const activeColor =
                    p === "alta" ? "#FF6B6B" : p === "media" ? "#FFA94D" : "#4ECB71";
                  const activeBg =
                    p === "alta"
                      ? "rgba(255,107,107,0.12)"
                      : p === "media"
                      ? "rgba(255,169,77,0.12)"
                      : "rgba(78,203,113,0.12)";
                  return (
                    <button
                      key={p}
                      onClick={() => setPriority(p)}
                      style={{
                        flex: 1,
                        padding: "7px 0",
                        borderRadius: 7,
                        border: "1px solid",
                        borderColor: isActive ? activeColor : "rgb(var(--cn-input-border))",
                        background: isActive ? activeBg : "transparent",
                        color: isActive ? activeColor : "rgb(var(--cn-muted))",
                        fontFamily: "Inter, sans-serif",
                        fontWeight: 700,
                        fontSize: 10,
                        textTransform: "uppercase",
                        letterSpacing: "0.06em",
                        cursor: "pointer",
                        transition: "all 0.15s",
                      }}
                      onMouseEnter={(e) => {
                        if (!isActive) (e.currentTarget as HTMLButtonElement).style.borderColor = "rgb(var(--cn-border))";
                      }}
                      onMouseLeave={(e) => {
                        if (!isActive) (e.currentTarget as HTMLButtonElement).style.borderColor = "rgb(var(--cn-input-border))";
                      }}
                    >
                      {p === "alta" ? "Alta" : p === "media" ? "Média" : "Baixa"}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Due date */}
            <div>
              <label style={LABEL}>
                <Calendar style={{ width: 12, height: 12 }} />
                Vencimento
              </label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                style={{ ...INPUT, colorScheme: "dark", color: dueDate ? "rgb(var(--cn-ink))" : "rgb(var(--cn-muted))" }}
                onFocus={(e) => (e.currentTarget.style.borderColor = "#6C5CE7")}
                onBlur={(e) => (e.currentTarget.style.borderColor = "rgb(var(--cn-input-border))")}
              />
            </div>
          </div>

          {/* Assignees */}
          <div style={{ marginBottom: 20 }}>
            <label style={LABEL}>
              <User style={{ width: 12, height: 12 }} />
              Responsáveis
            </label>

            {assignees.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
                {assignees.map((a, i) => (
                  <div
                    key={i}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      background: "rgb(var(--cn-input-bg))",
                      border: "1px solid rgb(var(--cn-input-border))",
                      borderRadius: 20,
                      padding: "4px 8px 4px 4px",
                    }}
                  >
                    <div
                      style={{
                        width: 22,
                        height: 22,
                        borderRadius: "50%",
                        background: avatarColor(a.name),
                        color: "#FFFFFF",
                        fontFamily: "Inter, sans-serif",
                        fontWeight: 700,
                        fontSize: 9,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                      }}
                    >
                      {initials(a.name)}
                    </div>
                    <span
                      style={{ fontSize: 12, color: "rgb(var(--cn-ink))", fontFamily: "Inter, sans-serif" }}
                    >
                      {a.name}
                    </span>
                    <button
                      onClick={() => removeAssignee(i)}
                      aria-label={`Remover ${a.name}`}
                      style={{
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        color: "rgb(var(--cn-muted))",
                        display: "flex",
                        padding: 2,
                        marginLeft: 2,
                        borderRadius: 4,
                        transition: "color 0.15s",
                      }}
                      onMouseEnter={(e) =>
                        ((e.currentTarget as HTMLButtonElement).style.color = "#FF6B6B")
                      }
                      onMouseLeave={(e) =>
                        ((e.currentTarget as HTMLButtonElement).style.color = "rgb(var(--cn-muted))")
                      }
                    >
                      <X style={{ width: 12, height: 12 }} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div style={{ display: "flex", gap: 8 }}>
              <input
                type="text"
                placeholder="Nome do responsável"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addAssignee()}
                style={{ ...INPUT, flex: 1 }}
                onFocus={(e) => (e.currentTarget.style.borderColor = "#6C5CE7")}
                onBlur={(e) => (e.currentTarget.style.borderColor = "rgb(var(--cn-input-border))")}
              />
              <button
                onClick={addAssignee}
                disabled={!newName.trim()}
                aria-label="Adicionar responsável"
                style={{
                  background: "#6C5CE7",
                  border: "none",
                  borderRadius: 8,
                  padding: "0 14px",
                  color: "#FFFFFF",
                  cursor: newName.trim() ? "pointer" : "not-allowed",
                  opacity: newName.trim() ? 1 : 0.4,
                  display: "flex",
                  alignItems: "center",
                  transition: "opacity 0.15s, background 0.15s",
                  flexShrink: 0,
                }}
                onMouseEnter={(e) => {
                  if (newName.trim())
                    (e.currentTarget as HTMLButtonElement).style.background = "#5A4BD1";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.background = "#6C5CE7";
                }}
              >
                <Plus style={{ width: 16, height: 16 }} />
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "14px 20px",
            borderTop: "1px solid rgb(var(--cn-border))",
            flexShrink: 0,
            gap: 8,
          }}
        >
          {/* Delete */}
          {showDeleteConfirm ? (
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span
                style={{
                  fontSize: 13,
                  color: "#FF6B6B",
                  fontFamily: "Inter, sans-serif",
                  whiteSpace: "nowrap",
                }}
              >
                Confirmar exclusão?
              </span>
              <button
                onClick={() => {
                  onDelete(task.id);
                  onClose();
                }}
                style={{
                  padding: "5px 12px",
                  background: "rgba(255,107,107,0.15)",
                  border: "1px solid rgba(255,107,107,0.3)",
                  borderRadius: 6,
                  color: "#FF6B6B",
                  fontFamily: "Inter, sans-serif",
                  fontWeight: 600,
                  fontSize: 12,
                  cursor: "pointer",
                }}
              >
                Excluir
              </button>
              <button
                onClick={() => setShowDeleteConfirm(false)}
                style={{
                  padding: "5px 12px",
                  background: "transparent",
                  border: "1px solid rgb(var(--cn-input-border))",
                  borderRadius: 6,
                  color: "rgb(var(--cn-ink2))",
                  fontFamily: "Inter, sans-serif",
                  fontSize: 12,
                  cursor: "pointer",
                }}
              >
                Cancelar
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowDeleteConfirm(true)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                background: "none",
                border: "none",
                color: "rgb(var(--cn-muted))",
                fontFamily: "Inter, sans-serif",
                fontSize: 13,
                cursor: "pointer",
                padding: 0,
                transition: "color 0.15s",
              }}
              onMouseEnter={(e) =>
                ((e.currentTarget as HTMLButtonElement).style.color = "#FF6B6B")
              }
              onMouseLeave={(e) =>
                ((e.currentTarget as HTMLButtonElement).style.color = "rgb(var(--cn-muted))")
              }
            >
              <Trash2 style={{ width: 14, height: 14 }} />
              Excluir
            </button>
          )}

          {/* Actions */}
          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={onClose}
              style={{
                padding: "8px 16px",
                background: "transparent",
                border: "1px solid rgb(var(--cn-input-border))",
                borderRadius: 8,
                color: "rgb(var(--cn-ink2))",
                fontFamily: "Inter, sans-serif",
                fontSize: 13,
                cursor: "pointer",
                transition: "border-color 0.15s",
              }}
              onMouseEnter={(e) =>
                ((e.currentTarget as HTMLButtonElement).style.borderColor = "rgb(var(--cn-border))")
              }
              onMouseLeave={(e) =>
                ((e.currentTarget as HTMLButtonElement).style.borderColor = "rgb(var(--cn-input-border))")
              }
            >
              Cancelar
            </button>
            <button
              onClick={handleSave}
              disabled={!title.trim() || !meetingId}
              style={{
                padding: "8px 20px",
                background: "#6C5CE7",
                border: "none",
                borderRadius: 8,
                color: "#FFFFFF",
                fontFamily: "Inter, sans-serif",
                fontWeight: 700,
                fontSize: 13,
                cursor: title.trim() && meetingId ? "pointer" : "not-allowed",
                opacity: title.trim() && meetingId ? 1 : 0.5,
                transition: "background 0.15s, opacity 0.15s",
              }}
              onMouseEnter={(e) => {
                if (title.trim() && meetingId)
                  (e.currentTarget as HTMLButtonElement).style.background = "#5A4BD1";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background = "#6C5CE7";
              }}
            >
              Salvar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
