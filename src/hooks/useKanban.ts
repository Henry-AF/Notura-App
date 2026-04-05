import { useState, useCallback } from "react";
import type { DropResult } from "@hello-pangea/dnd";
import type { Task } from "@/components/tasks/TaskCard";
import type { Column } from "@/components/tasks/KanbanColumn";

export type { Column, Task };

export function useKanban(initialColumns: Column[]) {
  const [columns, setColumns] = useState<Column[]>(initialColumns);

  const handleDragEnd = useCallback((result: DropResult) => {
    const { source, destination } = result;
    if (!destination) return;
    if (
      source.droppableId === destination.droppableId &&
      source.index === destination.index
    )
      return;

    setColumns((prev) => {
      const next = prev.map((col) => ({ ...col, tasks: [...col.tasks] }));

      const srcCol = next.find((c) => c.id === source.droppableId)!;
      const dstCol = next.find((c) => c.id === destination.droppableId)!;
      const [moved] = srcCol.tasks.splice(source.index, 1);

      if (dstCol.id === "done") {
        moved.completedDate = `Concluído em ${new Date().toLocaleDateString(
          "pt-BR",
          { day: "numeric", month: "short" }
        )}`;
        moved.columnId = "done";
      } else {
        moved.completedDate = undefined;
        moved.columnId = dstCol.id;
      }

      dstCol.tasks.splice(destination.index, 0, moved);
      return next;
    });
  }, []);

  const addTask = useCallback((columnId: string, task: Task) => {
    setColumns((prev) =>
      prev.map((col) =>
        col.id === columnId
          ? { ...col, tasks: [task, ...col.tasks] }
          : col
      )
    );
  }, []);

  return { columns, handleDragEnd, addTask };
}
