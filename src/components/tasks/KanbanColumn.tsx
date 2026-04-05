"use client";

import React from "react";
import { Droppable } from "@hello-pangea/dnd";
import { MoreHorizontal } from "lucide-react";
import { TaskCard } from "./TaskCard";
import type { Task } from "./TaskCard";

export interface Column {
  id: "todo" | "in_progress" | "done";
  title: string;
  dotColor: string;
  badgeColor: string;
  badgeBg: string;
  tasks: Task[];
}

export interface KanbanColumnProps {
  column: Column;
  index: number;
  onAddTask: (columnId: string) => void;
}

export function KanbanColumn({ column, onAddTask }: KanbanColumnProps) {
  return (
    <div
      style={{
        background: "#111111",
        border: "1px solid #1E1E1E",
        borderRadius: 14,
        padding: 16,
        minHeight: 200,
      }}
    >
      {/* Column header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          marginBottom: 16,
        }}
      >
        {/* Dot */}
        <div
          style={{
            width: 8,
            height: 8,
            borderRadius: "50%",
            background: column.dotColor,
            flexShrink: 0,
          }}
        />

        {/* Title */}
        <span
          style={{
            fontFamily: "Inter, sans-serif",
            fontWeight: 700,
            fontSize: 12,
            color: "#FFFFFF",
            textTransform: "uppercase",
            letterSpacing: "0.08em",
          }}
        >
          {column.title}
        </span>

        {/* Count badge */}
        <span
          style={{
            padding: "2px 8px",
            borderRadius: 999,
            fontFamily: "Inter, sans-serif",
            fontWeight: 700,
            fontSize: 11,
            color: column.badgeColor,
            background: column.badgeBg,
          }}
        >
          {column.tasks.length}
        </span>

        {/* More button */}
        <button
          type="button"
          aria-label="Opções da coluna"
          style={{
            marginLeft: "auto",
            background: "none",
            border: "none",
            padding: 4,
            cursor: "pointer",
            color: "#3A3A3A",
            display: "flex",
            alignItems: "center",
            transition: "color 0.15s",
          }}
          onMouseEnter={(e) =>
            ((e.currentTarget as HTMLButtonElement).style.color = "#606060")
          }
          onMouseLeave={(e) =>
            ((e.currentTarget as HTMLButtonElement).style.color = "#3A3A3A")
          }
        >
          <MoreHorizontal style={{ width: 16, height: 16 }} />
        </button>
      </div>

      {/* Droppable list */}
      <Droppable droppableId={column.id}>
        {(provided, snapshot) => (
          <div
            ref={provided.innerRef}
            {...provided.droppableProps}
            style={{
              borderRadius: 8,
              minHeight: 80,
              background: snapshot.isDraggingOver
                ? "rgba(108,92,231,0.04)"
                : "transparent",
              transition: "background 0.2s",
            }}
          >
            {column.tasks.map((task, idx) => (
              <TaskCard key={task.id} task={task} index={idx} />
            ))}
            {provided.placeholder}
          </div>
        )}
      </Droppable>

      {/* Add task button */}
      <button
        type="button"
        onClick={() => onAddTask(column.id)}
        style={{
          width: "100%",
          marginTop: 8,
          padding: 10,
          border: "1px dashed #2E2E2E",
          borderRadius: 8,
          color: "#3A3A3A",
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
          el.style.borderColor = "#2E2E2E";
          el.style.color = "#3A3A3A";
          el.style.background = "transparent";
        }}
      >
        + Adicionar tarefa
      </button>
    </div>
  );
}
