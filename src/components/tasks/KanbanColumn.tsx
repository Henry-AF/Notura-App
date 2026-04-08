"use client";

import React, { useState, useRef, useEffect } from "react";
import { Droppable } from "@hello-pangea/dnd";
import type { DraggableProvidedDragHandleProps } from "@hello-pangea/dnd";
import { TaskCard } from "./TaskCard";
import type { Task } from "./TaskCard";

export interface Column {
  id: string;
  title: string;
  dotColor: string;
  badgeColor: string;
  badgeBg: string;
  tasks: Task[];
}

export interface KanbanColumnProps {
  column: Column;
  onAddTask: (columnId: string) => void;
  onEditTask: (task: Task) => void;
  onDeleteColumn: (columnId: string) => void;
  onRenameColumn?: (columnId: string, newTitle: string) => void;
  canDelete?: boolean;
  dragHandleProps?: DraggableProvidedDragHandleProps | null;
}

export function KanbanColumn({
  column,
  onAddTask,
  onEditTask,
  onDeleteColumn,
  onRenameColumn,
  canDelete = true,
  dragHandleProps,
}: KanbanColumnProps) {
  const [showMenu, setShowMenu] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState(column.title);
  const titleInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editingTitle) titleInputRef.current?.focus();
  }, [editingTitle]);

  function handleStartRename() {
    setTitleDraft(column.title);
    setEditingTitle(true);
    setShowMenu(false);
  }

  function handleCommitRename() {
    const trimmed = titleDraft.trim();
    if (trimmed && trimmed !== column.title) {
      onRenameColumn?.(column.id, trimmed);
    }
    setEditingTitle(false);
  }

  function handleRenameKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") handleCommitRename();
    if (e.key === "Escape") setEditingTitle(false);
  }
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu on outside click
  useEffect(() => {
    if (!showMenu) return;
    function handle(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false);
        setConfirmDelete(false);
      }
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [showMenu]);

  function handleDeleteClick() {
    if (column.tasks.length === 0) {
      onDeleteColumn(column.id);
      setShowMenu(false);
    } else {
      setConfirmDelete(true);
    }
  }

  function handleConfirmDelete() {
    onDeleteColumn(column.id);
    setShowMenu(false);
    setConfirmDelete(false);
  }

  return (
    <div
      style={{
        width: 300,
        flexShrink: 0,
        display: "flex",
        flexDirection: "column",
        gap: 0,
      }}
    >
      {/* Column header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 12,
          padding: "0 2px",
        }}
        {...(dragHandleProps ?? {})}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, minWidth: 0 }}>
          <div
            style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: column.dotColor,
              flexShrink: 0,
            }}
          />
          {editingTitle ? (
            <input
              ref={titleInputRef}
              type="text"
              value={titleDraft}
              onChange={(e) => setTitleDraft(e.target.value)}
              onKeyDown={handleRenameKeyDown}
              onBlur={handleCommitRename}
              style={{
                fontFamily: "Inter, sans-serif",
                fontWeight: 600,
                fontSize: 13,
                color: "rgb(var(--cn-ink))",
                background: "rgb(var(--cn-input-bg))",
                border: "1px solid #6C5CE7",
                borderRadius: 6,
                padding: "2px 6px",
                width: "100%",
                outline: "none",
              }}
            />
          ) : (
            <span
              style={{
                fontFamily: "Inter, sans-serif",
                fontWeight: 600,
                fontSize: 13,
                color: "rgb(var(--cn-ink2))",
                letterSpacing: "0.03em",
                cursor: dragHandleProps ? "grab" : "default",
              }}
            >
              {column.title}
            </span>
          )}
          <span
            style={{
              fontFamily: "Inter, sans-serif",
              fontSize: 11,
              fontWeight: 700,
              color: column.badgeColor,
              background: column.badgeBg,
              padding: "1px 7px",
              borderRadius: 20,
              minWidth: 20,
              textAlign: "center",
            }}
          >
            {column.tasks.length}
          </span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          {/* Add task button */}
          <button
            onClick={() => onAddTask(column.id)}
            title="Adicionar tarefa"
            style={{
              width: 26,
              height: 26,
              borderRadius: 6,
              border: "none",
              background: "transparent",
              color: "rgb(var(--cn-muted))",
              fontSize: 20,
              lineHeight: 1,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              transition: "background 0.15s, color 0.15s",
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
            +
          </button>

          {/* Three-dot menu */}
          {canDelete && (
            <div style={{ position: "relative" }} ref={menuRef}>
              <button
                onClick={() => { setShowMenu((v) => !v); setConfirmDelete(false); }}
                title="Opcoes da coluna"
                style={{
                  width: 26,
                  height: 26,
                  borderRadius: 6,
                  border: "none",
                  background: "transparent",
                  color: "rgb(var(--cn-muted))",
                  fontSize: 16,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  transition: "background 0.15s, color 0.15s",
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
                &middot;&middot;&middot;
              </button>

              {showMenu && (
                <div
                  style={{
                    position: "absolute",
                    top: 30,
                    right: 0,
                    zIndex: 100,
                    background: "rgb(var(--cn-card))",
                    border: "1px solid rgb(var(--cn-border))",
                    borderRadius: 10,
                    padding: 8,
                    minWidth: 180,
                    boxShadow: "0 8px 24px rgba(0,0,0,0.15)",
                  }}
                >
                  {!confirmDelete ? (
                    <>
                      <button
                        onClick={handleStartRename}
                        style={{
                          width: "100%",
                          padding: "8px 10px",
                          borderRadius: 6,
                          border: "none",
                          background: "transparent",
                          color: "rgb(var(--cn-ink2))",
                          fontFamily: "Inter, sans-serif",
                          fontSize: 13,
                          textAlign: "left",
                          cursor: "pointer",
                          transition: "background 0.15s",
                        }}
                        onMouseEnter={(e) =>
                          ((e.currentTarget as HTMLButtonElement).style.background = "rgb(var(--cn-card2))")
                        }
                        onMouseLeave={(e) =>
                          ((e.currentTarget as HTMLButtonElement).style.background = "transparent")
                        }
                      >
                        Renomear coluna
                      </button>
                      <button
                        onClick={handleDeleteClick}
                        style={{
                          width: "100%",
                          padding: "8px 10px",
                          borderRadius: 6,
                          border: "none",
                          background: "transparent",
                          color: "#FF6B6B",
                          fontFamily: "Inter, sans-serif",
                          fontSize: 13,
                          textAlign: "left",
                          cursor: "pointer",
                          transition: "background 0.15s",
                        }}
                        onMouseEnter={(e) =>
                          ((e.currentTarget as HTMLButtonElement).style.background = "rgba(255,107,107,0.1)")
                        }
                        onMouseLeave={(e) =>
                          ((e.currentTarget as HTMLButtonElement).style.background = "transparent")
                        }
                      >
                        Excluir coluna
                      </button>
                    </>
                  ) : (
                    <div style={{ padding: "4px 2px" }}>
                      <p
                        style={{
                          fontFamily: "Inter, sans-serif",
                          fontSize: 12,
                        color: "rgb(var(--cn-ink2))",
                          margin: "0 0 8px 8px",
                          lineHeight: 1.4,
                        }}
                      >
                        {column.tasks.length} tarefa{column.tasks.length !== 1 ? "s" : ""} sera{column.tasks.length !== 1 ? "o" : ""} excluida{column.tasks.length !== 1 ? "s" : ""}. Confirmar?
                      </p>
                      <div style={{ display: "flex", gap: 6 }}>
                        <button
                          onClick={() => setConfirmDelete(false)}
                          style={{
                            flex: 1,
                            padding: "6px",
                            borderRadius: 6,
                          border: "1px solid rgb(var(--cn-border))",
                          background: "transparent",
                          color: "rgb(var(--cn-ink2))",
                            fontFamily: "Inter, sans-serif",
                            fontSize: 12,
                            cursor: "pointer",
                          }}
                        >
                          Cancelar
                        </button>
                        <button
                          onClick={handleConfirmDelete}
                          style={{
                            flex: 1,
                            padding: "6px",
                            borderRadius: 6,
                            border: "none",
                            background: "#FF6B6B",
                          color: "#fff",
                            fontFamily: "Inter, sans-serif",
                            fontSize: 12,
                            fontWeight: 600,
                            cursor: "pointer",
                          }}
                        >
                          Excluir
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Droppable zone */}
      <Droppable droppableId={column.id}>
        {(provided, snapshot) => (
          <div
            ref={provided.innerRef}
            {...provided.droppableProps}
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 8,
              minHeight: 100,
              padding: 8,
              borderRadius: 12,
              background: snapshot.isDraggingOver
                ? "rgba(108,92,231,0.04)"
                : "transparent",
              outline: snapshot.isDraggingOver
                ? "1.5px dashed rgba(108,92,231,0.3)"
                : "1.5px dashed transparent",
              transition: "background 180ms ease, outline 180ms ease",
            }}
          >
            {column.tasks.map((task, index) => (
              <TaskCard
                key={task.id}
                task={task}
                index={index}
                onEdit={onEditTask}
              />
            ))}
            {provided.placeholder}
          </div>
        )}
      </Droppable>
    </div>
  );
}
