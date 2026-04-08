"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { KanbanBoard, TasksPageHeader, TaskEditModal } from "@/components/tasks";
import { useKanban } from "@/hooks/useKanban";
import type { Column, Task } from "@/components/tasks";
import type { DropResult } from "@hello-pangea/dnd";
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
    id: "done",
    title: "Concluido",
    dotColor: "#4ECB71",
    badgeColor: "#4ECB71",
    badgeBg: "rgba(78,203,113,0.15)",
  },
];

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

function TasksBoardContent({
  initialColumns,
  meetings,
  onRegisterAddTask,
}: {
  initialColumns: Column[];
  meetings: TaskMeetingOption[];
  onRegisterAddTask?: (fn: (columnId: string) => void) => void;
}) {
  const { columns, handleDragEnd, addTask, updateTask, deleteTask, addColumn, removeColumn, renameColumn } =
    useKanban(initialColumns);

  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [draftColumnId, setDraftColumnId] = useState<string | null>(null);

  function isDraftTask(taskId: string) {
    return taskId.startsWith("task-");
  }

  const handleDragEndWithPersist = useCallback(
    async (result: DropResult) => {
      const { destination, source, type } = result;

      // Column reorder — no API persistence needed
      if (type === "COLUMN") {
        handleDragEnd(result);
        return;
      }

      const srcColumn = columns.find((c) => c.id === source.droppableId);
      const movedTask = srcColumn?.tasks[source.index];

      handleDragEnd(result);

      if (!destination || destination.droppableId === source.droppableId || !movedTask) return;

      const newCompleted = destination.droppableId === "done";
      if (isDraftTask(movedTask.id)) return;

      await updateTaskById(movedTask.id, { completed: newCompleted });
    },
    [handleDragEnd, columns]
  );

  // Register handleAddTask so parent's "Nova Tarefa" button can call it
  useEffect(() => {
    onRegisterAddTask?.(handleAddTask);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onRegisterAddTask]);

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
    const assigneeName =
      updates.assignees?.[0]?.name ?? updates.assignee?.name ?? null;

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
    if (isDraftTask(id)) {
      setDraftColumnId(null);
      return;
    }

    deleteTask(id);
    await deleteTaskById(id);
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
        onRenameColumn={renameColumn}
      />

      {editingTask && (
        <TaskEditModal
          task={editingTask}
          meetings={meetings}
          onSave={handleSaveTask}
          onDelete={handleDeleteTask}
          onClose={() => {
            setEditingTask(null);
            setDraftColumnId(null);
          }}
        />
      )}
    </>
  );
}

export default function TasksPage() {
  const [view, setView] = useState<"kanban" | "table">("kanban");
  const [initialColumns, setInitialColumns] = useState<Column[] | null>(null);
  const [meetings, setMeetings] = useState<TaskMeetingOption[]>([]);
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
      }
    }
    load();
  }, []);

  if (!initialColumns) return <LoadingState />;

  return (
    <>
      <TasksPageHeader
        view={view}
        onViewChange={setView}
        onNewTask={() => addTaskFnRef.current?.("todo")}
      />
      {view === "kanban" ? (
        <TasksBoardContent
          initialColumns={initialColumns}
          meetings={meetings}
          onRegisterAddTask={(fn) => { addTaskFnRef.current = fn; }}
        />
      ) : (
        <TasksTable columns={initialColumns} />
      )}
    </>
  );
}
