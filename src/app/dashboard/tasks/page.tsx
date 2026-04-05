"use client";

import React, { useCallback, useEffect, useState } from "react";
import { KanbanBoard, TasksPageHeader, TaskEditModal } from "@/components/tasks";
import { useKanban } from "@/hooks/useKanban";
import type { Column, Task } from "@/components/tasks";
import type { DropResult } from "@hello-pangea/dnd";
import { createClient } from "@/lib/supabase/client";
import { formatDate } from "@/lib/utils";

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
    id: "done",
    title: "Concluido",
    dotColor: "#4ECB71",
    badgeColor: "#4ECB71",
    badgeBg: "rgba(78,203,113,0.15)",
  },
];

function normalizePriority(p: string | null): Task["priority"] {
  const lower = (p ?? "").toLowerCase();
  if (lower === "alta") return "alta";
  if (lower === "media" || lower === "media") return "media";
  return "baixa";
}

function LoadingState() {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        height: 240,
      }}
    >
      <div
        style={{
          width: 36,
          height: 36,
          borderRadius: "50%",
          border: "2px solid #6C5CE7",
          borderTopColor: "transparent",
          animation: "spin 0.7s linear infinite",
        }}
      />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

function TasksTable({ columns }: { columns: Column[] }) {
  const allTasks = columns.flatMap((c) => c.tasks);
  return (
    <div
      style={{
        background: "rgb(var(--cn-card))",
        border: "1px solid rgb(var(--cn-border))",
        borderRadius: 14,
        overflow: "hidden",
      }}
    >
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ borderBottom: "1px solid rgb(var(--cn-border))" }}>
            {["Tarefa", "Prioridade", "Status", "Responsavel", "Data"].map((h) => (
              <th
                key={h}
                style={{
                  padding: "12px 16px",
                  textAlign: "left",
                  fontFamily: "Inter, sans-serif",
                  fontWeight: 600,
                  fontSize: 12,
                  color: "rgb(var(--cn-muted))",
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                }}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {allTasks.map((task, i) => (
            <tr
              key={task.id}
              style={{
                borderBottom: i < allTasks.length - 1 ? `1px solid rgb(var(--cn-border))` : undefined,
                transition: "background 0.15s",
              }}
              onMouseEnter={(e) =>
                ((e.currentTarget as HTMLTableRowElement).style.background = "rgb(var(--cn-card2))")
              }
              onMouseLeave={(e) =>
                ((e.currentTarget as HTMLTableRowElement).style.background = "transparent")
              }
            >
              <td
                style={{
                  padding: "12px 16px",
                  fontFamily: "Inter, sans-serif",
                  fontSize: 14,
                  color: task.columnId === "done" ? "rgb(var(--cn-muted))" : "rgb(var(--cn-ink))",
                  textDecoration: task.columnId === "done" ? "line-through" : "none",
                }}
              >
                {task.title}
              </td>
              <td style={{ padding: "12px 16px" }}>
                <span
                  style={{
                    fontFamily: "Inter, sans-serif",
                    fontSize: 11,
                    fontWeight: 700,
                    textTransform: "uppercase",
                    color:
                      task.priority === "alta"
                        ? "#FF6B6B"
                        : task.priority === "media"
                        ? "#FFA94D"
                        : "#4ECB71",
                  }}
                >
                  {task.priority === "alta" ? "ALTA" : task.priority === "media" ? "MEDIA" : "BAIXA"}
                </span>
              </td>
              <td
                style={{
                  padding: "12px 16px",
                  fontFamily: "Inter, sans-serif",
                  fontSize: 13,
                  color: "rgb(var(--cn-ink2))",
                }}
              >
                {columns.find((c) => c.id === task.columnId)?.title ?? "—"}
              </td>
              <td
                style={{
                  padding: "12px 16px",
                  fontFamily: "Inter, sans-serif",
                  fontSize: 13,
                  color: "rgb(var(--cn-ink2))",
                }}
              >
                {task.assignees?.[0]?.name ?? task.assignee?.name ?? "—"}
              </td>
              <td
                style={{
                  padding: "12px 16px",
                  fontFamily: "Inter, sans-serif",
                  fontSize: 13,
                  color: task.completedDate ? "#4ECB71" : "rgb(var(--cn-muted))",
                }}
              >
                {task.completedDate ?? task.dueDate ?? "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TasksBoardContent({ initialColumns }: { initialColumns: Column[] }) {
  const { columns, handleDragEnd, addTask, updateTask, deleteTask, addColumn, removeColumn } =
    useKanban(initialColumns);

  const [editingTask, setEditingTask] = useState<Task | null>(null);

  // Drag end: also persist completed to Supabase
  const handleDragEndWithPersist = useCallback(
    async (result: DropResult) => {
      const { destination, source } = result;
      const srcColumn = columns.find((c) => c.id === source.droppableId);
      const movedTask = srcColumn?.tasks[source.index];

      handleDragEnd(result);

      if (!destination || destination.droppableId === source.droppableId || !movedTask) return;

      const newCompleted = destination.droppableId === "done";
      const supabase = createClient();
      await supabase
        .from("tasks")
        .update({
          completed: newCompleted,
          completed_at: newCompleted ? new Date().toISOString() : null,
        })
        .eq("id", movedTask.id);
    },
    [handleDragEnd, columns]
  );

  function handleAddTask(columnId: string) {
    const id = `task-${Date.now()}`;
    const newTask: Task = {
      id,
      title: "Nova tarefa",
      priority: "media",
      columnId,
    };
    addTask(columnId, newTask);
    // Open modal immediately for the new task
    setEditingTask(newTask);
  }

  async function handleSaveTask(id: string, updates: Partial<Task>) {
    updateTask(id, updates);
    // Persist to Supabase if it is a DB task (UUID format)
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
    if (!isUUID) return;
    const supabase = createClient();
    await supabase
      .from("tasks")
      .update({
        description: updates.title,
        priority: updates.priority,
        due_date: updates.dueDate ?? null,
        owner: updates.assignees?.[0]?.name ?? updates.assignee?.name ?? null,
      })
      .eq("id", id);
  }

  async function handleDeleteTask(id: string) {
    deleteTask(id);
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
    if (!isUUID) return;
    const supabase = createClient();
    await supabase.from("tasks").delete().eq("id", id);
  }

  return (
    <>
      <style>{`
        @keyframes fade-slide-up {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .task-card {
          animation: fade-slide-up 0.22s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards;
          opacity: 0;
        }
      `}</style>

      <KanbanBoard
        columns={columns}
        onDragEnd={handleDragEndWithPersist}
        onAddTask={handleAddTask}
        onEditTask={(task) => setEditingTask(task)}
        onDeleteColumn={removeColumn}
        onAddColumn={addColumn}
      />

      {editingTask && (
        <TaskEditModal
          task={editingTask}
          onSave={handleSaveTask}
          onDelete={handleDeleteTask}
          onClose={() => setEditingTask(null)}
        />
      )}
    </>
  );
}

export default function TasksPage() {
  const [view, setView] = useState<"kanban" | "table">("kanban");
  const [initialColumns, setInitialColumns] = useState<Column[] | null>(null);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setInitialColumns(COLUMN_DEFS.map((def) => ({ ...def, tasks: [] })));
        return;
      }

      const { data: tasks } = await supabase
        .from("tasks")
        .select(
          "id, description, owner, due_date, priority, completed, completed_at, created_at, meetings(title, client_name)"
        )
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      const todoTasks: Task[] = [];
      const doneTasks: Task[] = [];

      for (const task of tasks ?? []) {
        const meeting = (
          task as unknown as {
            meetings: { title: string | null; client_name: string | null } | null;
          }
        ).meetings;
        const kanbanTask: Task = {
          id: task.id,
          title: task.description,
          priority: normalizePriority(task.priority),
          columnId: task.completed ? "done" : "todo",
          meetingSource: meeting?.client_name ?? meeting?.title ?? undefined,
          dueDate: task.due_date ? formatDate(task.due_date) : undefined,
          completedDate: task.completed_at
            ? `Concluido em ${new Date(task.completed_at).toLocaleDateString("pt-BR", {
                day: "numeric",
                month: "short",
              })}`
            : undefined,
          assignee: task.owner ? { name: task.owner } : undefined,
          assignees: task.owner ? [{ name: task.owner }] : undefined,
          generatedByAI: !!meeting,
        };
        if (task.completed) {
          doneTasks.push(kanbanTask);
        } else {
          todoTasks.push(kanbanTask);
        }
      }

      setInitialColumns([
        { ...COLUMN_DEFS[0], tasks: todoTasks },
        { ...COLUMN_DEFS[1], tasks: [] },
        { ...COLUMN_DEFS[2], tasks: doneTasks },
      ]);
    }
    load();
  }, []);

  if (!initialColumns) return <LoadingState />;

  return (
    <>
      <TasksPageHeader
        view={view}
        onViewChange={setView}
        onNewTask={() => {}}
      />
      {view === "kanban" ? (
        <TasksBoardContent initialColumns={initialColumns} />
      ) : (
        <TasksTable columns={initialColumns} />
      )}
    </>
  );
}
