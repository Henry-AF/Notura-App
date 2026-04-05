"use client";

import React from "react";
import { Draggable } from "@hello-pangea/dnd";
import { Video, Paperclip, Calendar } from "lucide-react";
import { PriorityBadge } from "./PriorityBadge";
import { ProgressBar } from "./ProgressBar";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Task {
  id: string;
  title: string;
  priority: "alta" | "media" | "baixa";
  columnId: "todo" | "in_progress" | "done";
  generatedByAI?: boolean;
  meetingSource?: string;
  filesCount?: number;
  dueDate?: string;
  completedDate?: string;
  progress?: number;
  assignee?: {
    name: string;
    avatarUrl?: string;
  };
}

export interface TaskCardProps {
  task: Task;
  index: number;
}

// ─── Avatar helper ────────────────────────────────────────────────────────────

function getInitials(name: string) {
  return name
    .split(" ")
    .slice(0, 2)
    .map((n) => n[0])
    .join("")
    .toUpperCase();
}

function hashColor(name: string) {
  const colors = [
    "#6C5CE7", "#00CEC9", "#FFA94D", "#FF6B6B",
    "#74C0FC", "#4ECB71", "#E91E8C", "#A29BFE",
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

function AssigneeAvatar({ assignee }: { assignee: NonNullable<Task["assignee"]> }) {
  if (assignee.avatarUrl) {
    return (
      <img
        src={assignee.avatarUrl}
        alt={assignee.name}
        style={{ width: 28, height: 28, borderRadius: "50%", objectFit: "cover" }}
      />
    );
  }
  const bg = hashColor(assignee.name);
  return (
    <div
      style={{
        width: 28,
        height: 28,
        borderRadius: "50%",
        background: bg,
        color: "#FFFFFF",
        fontFamily: "Inter, sans-serif",
        fontWeight: 700,
        fontSize: 10,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
      }}
    >
      {getInitials(assignee.name)}
    </div>
  );
}

// ─── TaskCard ─────────────────────────────────────────────────────────────────

export function TaskCard({ task, index }: TaskCardProps) {
  const isDone = task.columnId === "done";

  return (
    <Draggable draggableId={task.id} index={index}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          className="task-card"
          style={{
            background: "#1A1A1A",
            border: snapshot.isDragging
              ? "1px solid rgba(108,92,231,0.4)"
              : "1px solid #2A2A2A",
            borderRadius: 12,
            padding: 16,
            marginBottom: 10,
            cursor: snapshot.isDragging ? "grabbing" : "grab",
            userSelect: "none",
            boxShadow: snapshot.isDragging
              ? "0 12px 40px rgba(108,92,231,0.35)"
              : undefined,
            transform: snapshot.isDragging
              ? `${provided.draggableProps.style?.transform ?? ""} rotate(1.5deg) scale(1.02)`
              : provided.draggableProps.style?.transform,
            opacity: snapshot.isDragging ? 0.95 : 1,
            transition: snapshot.isDragging
              ? undefined
              : "box-shadow 0.15s, border-color 0.15s",
            animationDelay: `${index * 60}ms`,
            ...provided.draggableProps.style,
          }}
          onMouseEnter={(e) => {
            if (!snapshot.isDragging) {
              const el = e.currentTarget as HTMLDivElement;
              el.style.borderColor = "#3A3A3A";
              el.style.boxShadow = "0 4px 16px rgba(0,0,0,0.3)";
            }
          }}
          onMouseLeave={(e) => {
            if (!snapshot.isDragging) {
              const el = e.currentTarget as HTMLDivElement;
              el.style.borderColor = "#2A2A2A";
              el.style.boxShadow = "none";
            }
          }}
        >
          {/* Header: priority badge + AI badge */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
              marginBottom: 12,
            }}
          >
            <PriorityBadge priority={task.priority} />
            {task.generatedByAI && (
              <div
                style={{
                  width: 26,
                  height: 26,
                  borderRadius: "50%",
                  background: "#E91E8C",
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
                AI
              </div>
            )}
          </div>

          {/* Title */}
          <p
            style={{
              fontFamily: "Inter, sans-serif",
              fontWeight: 600,
              fontSize: 15,
              color: isDone ? "#606060" : "#FFFFFF",
              lineHeight: 1.4,
              margin: 0,
              textDecoration: isDone ? "line-through" : "none",
            }}
          >
            {task.title}
          </p>

          {/* Meeting source */}
          {task.meetingSource && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                marginTop: 10,
                cursor: "pointer",
                color: "#606060",
                transition: "color 0.15s",
              }}
              onMouseEnter={(e) => {
                const el = e.currentTarget as HTMLDivElement;
                el.style.color = "#A0A0A0";
              }}
              onMouseLeave={(e) => {
                const el = e.currentTarget as HTMLDivElement;
                el.style.color = "#606060";
              }}
            >
              <Video style={{ width: 12, height: 12, flexShrink: 0 }} />
              <span
                style={{
                  fontFamily: "Inter, sans-serif",
                  fontSize: 12,
                  color: "inherit",
                }}
              >
                {task.meetingSource}
              </span>
            </div>
          )}

          {/* AI generated label */}
          {task.generatedByAI && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                marginTop: 10,
              }}
            >
              <span style={{ fontSize: 12, color: "#A29BFE", lineHeight: 1 }}>
                ✦
              </span>
              <span
                style={{
                  fontFamily: "Inter, sans-serif",
                  fontSize: 12,
                  color: "#A29BFE",
                }}
              >
                Gerado pela Notura AI
              </span>
            </div>
          )}

          {/* Files count */}
          {task.filesCount !== undefined && task.filesCount > 0 && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                marginTop: 10,
              }}
            >
              <Paperclip
                style={{ width: 12, height: 12, color: "#606060", flexShrink: 0 }}
              />
              <span
                style={{
                  fontFamily: "Inter, sans-serif",
                  fontSize: 12,
                  color: "#606060",
                }}
              >
                {task.filesCount} {task.filesCount === 1 ? "arquivo" : "arquivos"}
              </span>
            </div>
          )}

          {/* Progress bar */}
          {task.progress !== undefined && <ProgressBar value={task.progress} />}

          {/* Footer: date + avatar */}
          {(task.dueDate || task.completedDate || task.assignee) && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginTop: 12,
              }}
            >
              {/* Date */}
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                {(task.dueDate || task.completedDate) && (
                  <>
                    <Calendar
                      style={{
                        width: 12,
                        height: 12,
                        color: task.completedDate ? "#4ECB71" : "#606060",
                        flexShrink: 0,
                      }}
                    />
                    <span
                      style={{
                        fontFamily: "Inter, sans-serif",
                        fontSize: 12,
                        color: task.completedDate ? "#4ECB71" : "#606060",
                      }}
                    >
                      {task.completedDate ?? task.dueDate}
                    </span>
                  </>
                )}
              </div>

              {/* Avatar */}
              {task.assignee && <AssigneeAvatar assignee={task.assignee} />}
            </div>
          )}
        </div>
      )}
    </Draggable>
  );
}
