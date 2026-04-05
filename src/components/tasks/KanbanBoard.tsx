"use client";

import React from "react";
import { DragDropContext } from "@hello-pangea/dnd";
import { KanbanColumn } from "./KanbanColumn";
import type { Column } from "./KanbanColumn";
import type { DropResult } from "@hello-pangea/dnd";

export interface KanbanBoardProps {
  columns: Column[];
  onDragEnd: (result: DropResult) => void;
  onAddTask: (columnId: string) => void;
}

export function KanbanBoard({ columns, onDragEnd, onAddTask }: KanbanBoardProps) {
  return (
    <DragDropContext onDragEnd={onDragEnd}>
      <div
        style={{
          overflowX: "auto",
          WebkitOverflowScrolling: "touch" as React.CSSProperties["WebkitOverflowScrolling"],
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: 20,
            alignItems: "start",
            minWidth: 840,
          }}
        >
          {columns.map((col, idx) => (
            <KanbanColumn
              key={col.id}
              column={col}
              index={idx}
              onAddTask={onAddTask}
            />
          ))}
        </div>
      </div>
    </DragDropContext>
  );
}
