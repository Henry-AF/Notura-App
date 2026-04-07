"use client";

import React, { useState } from "react";
import { Check } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface MeetingTask {
  id: string;
  text: string;
  completed: boolean;
  assignee?: string;
  priority?: "Alta" | "Média" | "Baixa";
  dueDate?: string;
  completedLabel?: string;
}

export interface MeetingTasksSidebarProps {
  tasks: MeetingTask[];
  onToggle: (id: string) => void;
  onAddTask: () => void;
}

// ─── TaskItem ─────────────────────────────────────────────────────────────────

export interface TaskItemProps {
  task: MeetingTask;
  onToggle: (id: string) => void;
}

export function TaskItem({ task, onToggle }: TaskItemProps) {
  const [animating, setAnimating] = useState(false);

  function handleToggle() {
    if (!task.completed) {
      setAnimating(true);
      setTimeout(() => setAnimating(false), 220);
    }
    onToggle(task.id);
  }

  const subtexts: string[] = [];
  if (task.assignee) subtexts.push(`Atribuído a: ${task.assignee}`);
  if (task.priority) subtexts.push(`Prioridade: ${task.priority}`);
  if (task.dueDate) subtexts.push(`Data: ${task.dueDate}`);
  if (task.completed && task.completedLabel) subtexts.push(task.completedLabel);

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={handleToggle}
      onKeyDown={(e) => e.key === "Enter" && handleToggle()}
      style={{
        background: "rgb(var(--cn-bg))",
        borderRadius: 8,
        padding: "12px 14px",
        display: "flex",
        alignItems: "flex-start",
        gap: 12,
        marginBottom: 8,
        cursor: "pointer",
        transition: "background 0.15s",
      }}
      onMouseEnter={(e) =>
        ((e.currentTarget as HTMLDivElement).style.background = "rgb(var(--cn-card2))")
      }
      onMouseLeave={(e) =>
        ((e.currentTarget as HTMLDivElement).style.background = "rgb(var(--cn-bg))")
      }
    >
      {/* Checkbox */}
      <div
        style={{
          width: 18,
          height: 18,
          borderRadius: 4,
          border: task.completed
            ? "1.5px solid #6C5CE7"
            : "1.5px solid rgb(var(--cn-input-border))",
          background: task.completed ? "#6C5CE7" : "transparent",
          flexShrink: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          marginTop: 1,
          transition: "all 0.15s",
          transform: animating ? "scale(1.1)" : "scale(1)",
        }}
      >
        {task.completed && (
          <Check style={{ width: 10, height: 10, color: "#FFFFFF" }} />
        )}
      </div>

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <p
          style={{
            fontFamily: "Inter, sans-serif",
            fontWeight: 500,
            fontSize: 13,
            color: task.completed ? "rgb(var(--cn-muted))" : "rgb(var(--cn-ink))",
            textDecoration: task.completed ? "line-through" : "none",
            margin: 0,
            transition: "color 0.15s",
          }}
        >
          {task.text}
        </p>
        {subtexts.length > 0 && (
          <p
            style={{
              fontFamily: "Inter, sans-serif",
              fontWeight: 400,
              fontSize: 11,
              color: "rgb(var(--cn-muted))",
              marginTop: 3,
              marginBottom: 0,
            }}
          >
            {subtexts.join(" · ")}
          </p>
        )}
      </div>
    </div>
  );
}

// ─── MeetingTasksSidebar ──────────────────────────────────────────────────────

export function MeetingTasksSidebar({
  tasks,
  onToggle,
  onAddTask,
}: MeetingTasksSidebarProps) {
  const done = tasks.filter((t) => t.completed).length;

  // Sort: pending first, completed at end
  const sorted = [
    ...tasks.filter((t) => !t.completed),
    ...tasks.filter((t) => t.completed),
  ];

  return (
    <div
      style={{
        background: "rgb(var(--cn-card))",
        border: "1px solid rgb(var(--cn-border))",
        borderRadius: 14,
        padding: 20,
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 16,
        }}
      >
        <p
          style={{
            fontFamily: "'Plus Jakarta Sans', sans-serif",
            fontWeight: 700,
            fontSize: 16,
            color: "rgb(var(--cn-ink))",
            margin: 0,
          }}
        >
          Tarefas da Reunião
        </p>
        <span
          style={{
            background: "rgba(78,203,113,0.12)",
            color: "#4ECB71",
            fontFamily: "Inter, sans-serif",
            fontWeight: 600,
            fontSize: 11,
            padding: "3px 10px",
            borderRadius: 999,
          }}
        >
          {done}/{tasks.length} Concluído
        </span>
      </div>

      {/* Tasks */}
      {sorted.map((task) => (
        <TaskItem key={task.id} task={task} onToggle={onToggle} />
      ))}

      {/* Add task button */}
      <button
        type="button"
        onClick={onAddTask}
        style={{
          width: "100%",
          marginTop: 8,
          padding: 10,
          border: "1px dashed rgb(var(--cn-border))",
          borderRadius: 8,
          color: "rgb(var(--cn-muted))",
          fontFamily: "Inter, sans-serif",
          fontWeight: 500,
          fontSize: 13,
          textAlign: "center",
          cursor: "pointer",
          background: "transparent",
          transition: "all 0.15s",
        }}
        onMouseEnter={(e) => {
          const el = e.currentTarget as HTMLButtonElement;
          el.style.borderColor = "#6C5CE7";
          el.style.color = "#A29BFE";
          el.style.background = "rgba(108,92,231,0.05)";
        }}
        onMouseLeave={(e) => {
          const el = e.currentTarget as HTMLButtonElement;
          el.style.borderColor = "rgb(var(--cn-border))";
          el.style.color = "rgb(var(--cn-muted))";
          el.style.background = "transparent";
        }}
      >
        + Nova Tarefa
      </button>
    </div>
  );
}
