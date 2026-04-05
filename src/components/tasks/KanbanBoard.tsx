"use client";
"use client";

import React, { useState, useRef, useEffect } from "react";
import { DragDropContext } from "@hello-pangea/dnd";
import { KanbanColumn } from "./KanbanColumn";
import type { Column } from "./KanbanColumn";
import type { Task } from "./TaskCard";
import type { DropResult } from "@hello-pangea/dnd";
import { Plus, Check, X } from "lucide-react";

export interface KanbanBoardProps {
  columns: Column[];
  onDragEnd: (result: DropResult) => void;
  onAddTask: (columnId: string) => void;
  onEditTask: (task: Task) => void;
  onDeleteColumn: (columnId: string) => void;
  onAddColumn: (title: string) => void;
}

export function KanbanBoard({
  columns,
  onDragEnd,
  onAddTask,
  onEditTask,
  onDeleteColumn,
  onAddColumn,
}: KanbanBoardProps) {
  const [addingColumn, setAddingColumn] = useState(false);
  const [newColumnTitle, setNewColumnTitle] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (addingColumn) inputRef.current?.focus();
  }, [addingColumn]);

  function handleConfirmAddColumn() {
    const title = newColumnTitle.trim();
    if (title) {
      onAddColumn(title);
    }
    setNewColumnTitle("");
    setAddingColumn(false);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") handleConfirmAddColumn();
    if (e.key === "Escape") {
      setAddingColumn(false);
      setNewColumnTitle("");
    }
  }

  return (
    <DragDropContext onDragEnd={onDragEnd}>
      <div
        style={{
          overflowX: "auto",
          WebkitOverflowScrolling: "touch" as React.CSSProperties["WebkitOverflowScrolling"],
          paddingBottom: 8,
        }}
      >
        <div
          style={{
            display: "flex",
            gap: 20,
            alignItems: "flex-start",
            minWidth: "max-content",
          }}
        >
          {/* Columns */}
          {columns.map((col, idx) => (
            <div key={col.id} style={{ width: 300, flexShrink: 0 }}>
              <KanbanColumn
                column={col}
                index={idx}
                onAddTask={onAddTask}
                onEditTask={onEditTask}
                onDeleteColumn={onDeleteColumn}
                canDelete={true}
              />
            </div>
          ))}

          {/* Add column */}
          {addingColumn ? (
            <div
              style={{
                width: 300,
                flexShrink: 0,
                background: "#111111",
                border: "1px solid #2A2A2A",
                borderRadius: 14,
                padding: 16,
              }}
            >
              <p
                style={{
                  fontFamily: "Inter, sans-serif",
                  fontWeight: 700,
                  fontSize: 12,
                  color: "#A0A0A0",
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                  marginBottom: 10,
                  margin: "0 0 10px",
                }}
              >
                Nome da coluna
              </p>
              <input
                ref={inputRef}
                type="text"
                value={newColumnTitle}
                onChange={(e) => setNewColumnTitle(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ex: Em Revisão"
                style={{
                  width: "100%",
                  background: "#1E1E1E",
                  border: "1px solid #2A2A2A",
                  borderRadius: 8,
                  padding: "9px 12px",
                  color: "#FFFFFF",
                  fontSize: 14,
                  fontFamily: "Inter, sans-serif",
                  outline: "none",
                  boxSizing: "border-box",
                  marginBottom: 10,
                  transition: "border-color 0.15s",
                }}
                onFocus={(e) => (e.currentTarget.style.borderColor = "#6C5CE7")}
                onBlur={(e) => (e.currentTarget.style.borderColor = "#2A2A2A")}
              />
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  onClick={handleConfirmAddColumn}
                  style={{
                    flex: 1,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 6,
                    padding: "8px 0",
                    background: "#6C5CE7",
                    border: "none",
                    borderRadius: 8,
                    color: "#FFFFFF",
                    fontFamily: "Inter, sans-serif",
                    fontWeight: 600,
                    fontSize: 13,
                    cursor: "pointer",
                    transition: "background 0.15s",
                  }}
                  onMouseEnter={(e) =>
                    ((e.currentTarget as HTMLButtonElement).style.background = "#5A4BD1")
                  }
                  onMouseLeave={(e) =>
                    ((e.currentTarget as HTMLButtonElement).style.background = "#6C5CE7")
                  }
                >
                  <Check style={{ width: 14, height: 14 }} />
                  Criar
                </button>
                <button
                  onClick={() => {
                    setAddingColumn(false);
                    setNewColumnTitle("");
                  }}
                  style={{
                    width: 38,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: 0,
                    background: "transparent",
                    border: "1px solid #2A2A2A",
                    borderRadius: 8,
                    color: "#606060",
                    cursor: "pointer",
                    transition: "border-color 0.15s, color 0.15s",
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.borderColor = "#3A3A3A";
                    (e.currentTarget as HTMLButtonElement).style.color = "#A0A0A0";
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.borderColor = "#2A2A2A";
                    (e.currentTarget as HTMLButtonElement).style.color = "#606060";
                  }}
                >
                  <X style={{ width: 14, height: 14 }} />
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setAddingColumn(true)}
              style={{
                width: 300,
                flexShrink: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                padding: "12px 16px",
                background: "transparent",
                border: "1.5px dashed #2A2A2A",
                borderRadius: 14,
                color: "#3A3A3A",
                fontFamily: "Inter, sans-serif",
                fontWeight: 600,
                fontSize: 13,
                cursor: "pointer",
                height: 56,
                transition: "all 0.18s ease",
              }}
              onMouseEnter={(e) => {
                const el = e.currentTarget as HTMLButtonElement;
                el.style.borderColor = "#6C5CE7";
                el.style.color = "#A29BFE";
                el.style.background = "rgba(108,92,231,0.05)";
              }}
              onMouseLeave={(e) => {
                const el = e.currentTarget as HTMLButtonElement;
                el.style.borderColor = "#2A2A2A";
                el.style.color = "#3A3A3A";
                el.style.background = "transparent";
              }}
            >
              <Plus style={{ width: 16, height: 16 }} />
              Nova coluna
            </button>
          )}
        </div>
      </div>
    </DragDropContext>
  );
}

