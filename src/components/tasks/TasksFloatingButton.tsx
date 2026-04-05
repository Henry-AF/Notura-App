"use client";

import React from "react";
import { Sparkles } from "lucide-react";

export interface TasksFloatingButtonProps {
  onClick: () => void;
}

export function TasksFloatingButton({ onClick }: TasksFloatingButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Nova tarefa"
      style={{
        position: "fixed",
        bottom: 28,
        right: 28,
        width: 52,
        height: 52,
        borderRadius: "50%",
        background: "#6C5CE7",
        color: "#FFFFFF",
        border: "none",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: "pointer",
        boxShadow: "0 4px 20px rgba(108,92,231,0.45)",
        transition: "background 0.15s, transform 0.15s, box-shadow 0.15s",
        zIndex: 40,
      }}
      onMouseEnter={(e) => {
        const el = e.currentTarget as HTMLButtonElement;
        el.style.background = "#5A4BD1";
        el.style.transform = "scale(1.08)";
        el.style.boxShadow = "0 6px 28px rgba(108,92,231,0.6)";
      }}
      onMouseLeave={(e) => {
        const el = e.currentTarget as HTMLButtonElement;
        el.style.background = "#6C5CE7";
        el.style.transform = "scale(1)";
        el.style.boxShadow = "0 4px 20px rgba(108,92,231,0.45)";
      }}
      onMouseDown={(e) => {
        (e.currentTarget as HTMLButtonElement).style.transform = "scale(0.95)";
      }}
      onMouseUp={(e) => {
        (e.currentTarget as HTMLButtonElement).style.transform = "scale(1.08)";
      }}
    >
      <Sparkles style={{ width: 22, height: 22 }} />
    </button>
  );
}
