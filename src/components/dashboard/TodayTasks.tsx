"use client";

import React, { useState } from "react";

export interface Task {
  id: string;
  text: string;
  completed: boolean;
  isNew?: boolean;
}

export interface TodayTasksProps {
  tasks: Task[];
  newCount: number;
  onToggle: (id: string) => void;
}

function TaskItem({
  task,
  onToggle,
}: {
  task: Task;
  onToggle: (id: string) => void;
}) {
  const [animating, setAnimating] = useState(false);

  function handleToggle() {
    if (!task.completed) {
      setAnimating(true);
      setTimeout(() => setAnimating(false), 220);
    }
    onToggle(task.id);
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={handleToggle}
      onKeyDown={(e) => e.key === "Enter" && handleToggle()}
      style={{
        background: "#1C1C1C",
        border: "1px solid #2E2E2E",
        borderRadius: "8px",
        padding: "12px 14px",
        display: "flex",
        alignItems: "center",
        gap: "12px",
        marginBottom: "8px",
        cursor: "pointer",
        transition: "background 0.15s",
      }}
      onMouseEnter={(e) =>
        ((e.currentTarget as HTMLDivElement).style.background = "#242424")
      }
      onMouseLeave={(e) =>
        ((e.currentTarget as HTMLDivElement).style.background = "#1C1C1C")
      }
    >
      {/* Checkbox circle */}
      <div
        style={{
          width: 18,
          height: 18,
          borderRadius: "50%",
          border: task.completed ? "1.5px solid #6C5CE7" : "1.5px solid #3A3A3A",
          background: task.completed ? "#6C5CE7" : "transparent",
          flexShrink: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          transition: "all 0.15s",
          transform: animating ? "scale(1.1)" : "scale(1)",
        }}
      >
        {task.completed && (
          <span style={{ color: "#FFFFFF", fontSize: "10px", lineHeight: 1 }}>
            ✓
          </span>
        )}
      </div>

      {/* Text */}
      <span
        style={{
          fontFamily: "Inter, sans-serif",
          fontWeight: 500,
          fontSize: "14px",
          color: task.completed ? "#606060" : "#FFFFFF",
          textDecoration: task.completed ? "line-through" : "none",
          transition: "color 0.15s",
          flex: 1,
        }}
      >
        {task.text}
      </span>
    </div>
  );
}

export function TodayTasks({ tasks, newCount, onToggle }: TodayTasksProps) {
  // Completed tasks go to end
  const sorted = [
    ...tasks.filter((t) => !t.completed),
    ...tasks.filter((t) => t.completed),
  ];

  return (
    <div>
      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "14px",
        }}
      >
        <p
          style={{
            fontFamily: "'Plus Jakarta Sans', sans-serif",
            fontWeight: 700,
            fontSize: "16px",
            color: "#FFFFFF",
            margin: 0,
          }}
        >
          Tarefas de hoje
        </p>
        {newCount > 0 && (
          <span
            style={{
              background: "#6C5CE7",
              color: "#FFFFFF",
              fontSize: "10px",
              fontWeight: 700,
              padding: "3px 10px",
              borderRadius: "999px",
              fontFamily: "Inter, sans-serif",
            }}
          >
            {newCount} Novas
          </span>
        )}
      </div>

      {/* Task list */}
      {sorted.map((task) => (
        <TaskItem key={task.id} task={task} onToggle={onToggle} />
      ))}
    </div>
  );
}
