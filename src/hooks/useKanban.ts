import { useState, useCallback } from "react";
import type { DropResult } from "@hello-pangea/dnd";
import type { Task } from "@/components/tasks/TaskCard";
import type { Column } from "@/components/tasks/KanbanColumn";

export type { Column, Task };

// Palette for auto-assigned new column colors
const COLUMN_COLORS = [
  { dot: "#A29BFE", badge: "#A29BFE", bg: "rgba(162,155,254,0.15)" },
  { dot: "#FFA94D", badge: "#FFA94D", bg: "rgba(255,169,77,0.15)" },
  { dot: "#4ECB71", badge: "#4ECB71", bg: "rgba(78,203,113,0.15)" },
  { dot: "#FF6B6B", badge: "#FF6B6B", bg: "rgba(255,107,107,0.15)" },
  { dot: "#74C0FC", badge: "#74C0FC", bg: "rgba(116,192,252,0.15)" },
  { dot: "#E91E8C", badge: "#E91E8C", bg: "rgba(233,30,140,0.15)" },
];

export function useKanban(initialColumns: Column[]) {
  const [columns, setColumns] = useState<Column[]>(initialColumns);

  // Drag & drop (tasks and columns)
  const handleDragEnd = useCallback((result: DropResult) => {
    const { source, destination, type } = result;
    if (!destination) return;
    if (
      source.droppableId === destination.droppableId &&
      source.index === destination.index
    )
      return;

    // Column reorder
    if (type === "COLUMN") {
      setColumns((prev) => {
        const next = [...prev];
        const [removed] = next.splice(source.index, 1);
        next.splice(destination.index, 0, removed);
        return next;
      });
      return;
    }

    setColumns((prev) => {
      const next = prev.map((col) => ({ ...col, tasks: [...col.tasks] }));

      const srcCol = next.find((c) => c.id === source.droppableId)!;
      const dstCol = next.find((c) => c.id === destination.droppableId)!;
      const [moved] = srcCol.tasks.splice(source.index, 1);

      if (dstCol.id === "completed") {
        moved.completedDate = `Concluido em ${new Date().toLocaleDateString(
          "pt-BR",
          { day: "numeric", month: "short" }
        )}`;
        moved.columnId = "completed";
      } else {
        moved.completedDate = undefined;
        moved.columnId = dstCol.id;
      }

      dstCol.tasks.splice(destination.index, 0, moved);
      return next;
    });
  }, []);

  // Add task
  const addTask = useCallback((columnId: string, task: Task) => {
    setColumns((prev) =>
      prev.map((col) =>
        col.id === columnId ? { ...col, tasks: [task, ...col.tasks] } : col
      )
    );
  }, []);

  // Update task
  const updateTask = useCallback((taskId: string, updates: Partial<Task>) => {
    setColumns((prev) =>
      prev.map((col) => ({
        ...col,
        tasks: col.tasks.map((t) =>
          t.id === taskId ? { ...t, ...updates } : t
        ),
      }))
    );
  }, []);

  // Delete task
  const deleteTask = useCallback((taskId: string) => {
    setColumns((prev) =>
      prev.map((col) => ({
        ...col,
        tasks: col.tasks.filter((t) => t.id !== taskId),
      }))
    );
  }, []);

  // Add column
  const addColumn = useCallback((title: string) => {
    setColumns((prev) => {
      const colorIdx = prev.length % COLUMN_COLORS.length;
      const palette = COLUMN_COLORS[colorIdx];
      const newCol: Column = {
        id: `col-${Date.now()}`,
        title,
        dotColor: palette.dot,
        badgeColor: palette.badge,
        badgeBg: palette.bg,
        tasks: [],
      };
      return [...prev, newCol];
    });
  }, []);

  // Remove column
  const removeColumn = useCallback((columnId: string) => {
    setColumns((prev) => prev.filter((c) => c.id !== columnId));
  }, []);

  // Rename column
  const renameColumn = useCallback((columnId: string, newTitle: string) => {
    setColumns((prev) =>
      prev.map((col) =>
        col.id === columnId ? { ...col, title: newTitle } : col
      )
    );
  }, []);

  // Move column (drag & drop)
  const moveColumn = useCallback((fromIndex: number, toIndex: number) => {
    setColumns((prev) => {
      const next = [...prev];
      const [removed] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, removed);
      return next;
    });
  }, []);

  // Reset columns from external source (e.g. after API error revert)
  const resetColumns = useCallback((newColumns: Column[]) => {
    setColumns(newColumns);
  }, []);

  return { columns, handleDragEnd, addTask, updateTask, deleteTask, addColumn, removeColumn, renameColumn, moveColumn, resetColumns };
}
