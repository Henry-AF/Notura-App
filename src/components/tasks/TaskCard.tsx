"use client";

import React from "react";
import { Draggable } from "@hello-pangea/dnd";

export interface Task {
  id: string;
  title: string;
  priority: "alta" | "media" | "baixa";
  columnId: string;
  meetingId?: string;
  meetingSource?: string;
  dueDate?: string;
  completedDate?: string;
  assignee?: { name: string; avatarUrl?: string };
  assignees?: { name: string; avatarUrl?: string }[];
  description?: string;
  generatedByAI?: boolean;
}

export interface TaskCardProps {
  task: Task;
  index: number;
  onEdit?: (task: Task) => void;
}

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/);
  return parts.length >= 2
    ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    : name.slice(0, 2).toUpperCase();
}

const AVATAR_PALETTE = [
  ["#6C5CE7", "#A29BFE20"],
  ["#E91E8C", "#E91E8C20"],
  ["#FFA94D", "#FFA94D20"],
  ["#4ECB71", "#4ECB7120"],
  ["#74C0FC", "#74C0FC20"],
];

function hashColor(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xffffff;
  return AVATAR_PALETTE[h % AVATAR_PALETTE.length];
}

function Avatar({ name, size = 24 }: { name: string; size?: number }) {
  const [text, bg] = hashColor(name);
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        background: bg,
        border: `1.5px solid ${text}`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: size * 0.38,
        fontWeight: 700,
        color: text,
        fontFamily: "Inter, sans-serif",
        flexShrink: 0,
        userSelect: "none",
      }}
    >
      {getInitials(name)}
    </div>
  );
}

function AssigneeAvatars({ assignees }: { assignees: { name: string; avatarUrl?: string }[] }) {
  if (!assignees.length) return null;
  const visible = assignees.slice(0, 3);
  const overflow = assignees.length - visible.length;
  return (
    <div style={{ display: "flex", alignItems: "center" }}>
      {visible.map((a, i) => (
        <div key={i} style={{ marginLeft: i === 0 ? 0 : -6 }}>
          <Avatar name={a.name} size={22} />
        </div>
      ))}
      {overflow > 0 && (
        <div
          style={{
            marginLeft: -6,
            width: 22,
            height: 22,
            borderRadius: "50%",
            background: "#2E2E2E",
            border: "1.5px solid #3E3E3E",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 9,
            fontWeight: 700,
            color: "#A0A0A0",
            fontFamily: "Inter, sans-serif",
          }}
        >
          +{overflow}
        </div>
      )}
    </div>
  );
}

const PRIORITY_COLORS: Record<Task["priority"], { border: string; dot: string; label: string }> = {
  alta:  { border: "rgba(255,107,107,0.3)",  dot: "#FF6B6B", label: "ALTA" },
  media: { border: "rgba(255,169,77,0.3)",   dot: "#FFA94D", label: "MEDIA" },
  baixa: { border: "rgba(78,203,113,0.3)",   dot: "#4ECB71", label: "BAIXA" },
};

export function TaskCard({ task, index, onEdit }: TaskCardProps) {
  const isDone = task.columnId === "done";
  const p = PRIORITY_COLORS[task.priority];
  const allAssignees: { name: string; avatarUrl?: string }[] = task.assignees?.length
    ? task.assignees
    : task.assignee
    ? [task.assignee]
    : [];

  return (
    <Draggable draggableId={task.id} index={index}>
      {(provided, snapshot) => {
        const libStyle = provided.draggableProps.style as React.CSSProperties | undefined;
        const libTransform = libStyle?.transform ?? "";
        const extraTransform = snapshot.isDragging ? "rotate(1.8deg) scale(1.03)" : "";
        const composedTransform = [libTransform, extraTransform].filter(Boolean).join(" ");

        return (
          <div
            ref={provided.innerRef}
            {...provided.draggableProps}
            {...provided.dragHandleProps}
            onClick={() => !snapshot.isDragging && onEdit?.(task)}
            style={{
              ...libStyle,
              transform: composedTransform || undefined,
              transition: snapshot.isDragging
                ? libStyle?.transition
                : "box-shadow 180ms ease, border-color 180ms ease, transform 220ms cubic-bezier(0.25, 0.46, 0.45, 0.94)",
              willChange: snapshot.isDragging ? "transform" : undefined,
              background: snapshot.isDragging ? "rgb(var(--cn-card2))" : "rgb(var(--cn-card))",
              border: `1px solid ${snapshot.isDragging ? p.border : "rgb(var(--cn-border))"}`,
              borderRadius: 10,
              padding: "12px 14px",
              cursor: "pointer",
              userSelect: "none",
              boxShadow: snapshot.isDragging
                ? `0 8px 32px rgba(0,0,0,0.45), 0 0 0 1px ${p.border}`
                : "0 1px 3px rgba(0,0,0,0.25)",
              opacity: isDone ? 0.6 : 1,
            }}
          >
            {/* Priority badge */}
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
              <div style={{ width: 6, height: 6, borderRadius: "50%", background: p.dot, flexShrink: 0 }} />
              <span
                style={{
                  fontFamily: "Inter, sans-serif",
                  fontSize: 10,
                  fontWeight: 700,
                  color: p.dot,
                  letterSpacing: "0.07em",
                  textTransform: "uppercase",
                }}
              >
                {p.label}
              </span>
            </div>

            {/* Title */}
            <p
              style={{
                fontFamily: "Inter, sans-serif",
                fontSize: 13.5,
                fontWeight: 500,
                color: isDone ? "rgb(var(--cn-muted))" : "rgb(var(--cn-ink))",
                margin: 0,
                lineHeight: 1.4,
                textDecoration: isDone ? "line-through" : "none",
                marginBottom: task.description ? 6 : 0,
                overflowWrap: "break-word",
              }}
            >
              {task.title}
            </p>

            {/* Description preview */}
            {task.description && !isDone && (
              <p
                style={{
                  fontFamily: "Inter, sans-serif",
                  fontSize: 11.5,
                  color: "rgb(var(--cn-ink2))",
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: "vertical",
                  overflow: "hidden",
                  marginBottom: 6,
                }}
              >
                {task.description}
              </p>
            )}

            {/* Footer */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 10 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                {(task.dueDate || task.completedDate) && (
                  <span
                    style={{
                      fontFamily: "Inter, sans-serif",
                      fontSize: 11,
                    color: task.completedDate ? "#4ECB71" : "rgb(var(--cn-ink2))",
                    background: task.completedDate ? "rgba(78,203,113,0.1)" : "rgb(var(--cn-card2))",
                      padding: "2px 6px",
                      borderRadius: 4,
                    }}
                  >
                    {task.completedDate ?? task.dueDate}
                  </span>
                )}
                {task.generatedByAI && (
                  <span
                    style={{
                      fontFamily: "Inter, sans-serif",
                      fontSize: 10,
                      color: "#6C5CE7",
                      background: "rgba(108,92,231,0.1)",
                      padding: "2px 5px",
                      borderRadius: 4,
                    }}
                  >
                    IA
                  </span>
                )}
              </div>
              <AssigneeAvatars assignees={allAssignees} />
            </div>

            {task.meetingSource && !isDone && (
              <div
                style={{
                  marginTop: 7,
                  fontFamily: "Inter, sans-serif",
                  fontSize: 10.5,
                  color: "rgb(var(--cn-muted))",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {task.meetingSource}
              </div>
            )}
          </div>
        );
      }}
    </Draggable>
  );
}
