"use client";

import React from "react";
import { LayoutGrid, Table, Plus } from "lucide-react";

export interface TasksPageHeaderProps {
  view: "kanban" | "table";
  onViewChange: (view: "kanban" | "table") => void;
  onNewTask: () => void;
}

export function TasksPageHeader({
  view,
  onViewChange,
  onNewTask,
}: TasksPageHeaderProps) {
  return (
    <div style={{ marginBottom: 28 }}>
      {/* Top row */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 12,
        }}
      >
        {/* Title + subtitle */}
        <div>
          <h1
            style={{
              fontFamily: "'Plus Jakarta Sans', sans-serif",
              fontWeight: 800,
              fontSize: 40,
              color: "rgb(var(--cn-ink))",
              margin: 0,
              lineHeight: 1.1,
            }}
          >
            Tarefas
          </h1>
          <p
            style={{
              fontFamily: "Inter, sans-serif",
              fontWeight: 400,
              fontSize: 14,
              color: "rgb(var(--cn-muted))",
              marginTop: 4,
              marginBottom: 0,
            }}
          >
            Gerencie suas entregas e acompanhe o progresso da equipe.
          </p>
        </div>

        {/* Controls */}
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {/* Toggle */}
          <div
            style={{
              display: "flex",
              background: "rgb(var(--cn-card))",
              border: "1px solid rgb(var(--cn-border))",
              borderRadius: 8,
              padding: 4,
              gap: 2,
            }}
          >
            {(["kanban", "table"] as const).map((v) => {
              const active = view === v;
              return (
                <button
                  key={v}
                  type="button"
                  onClick={() => onViewChange(v)}
                  style={{
                    padding: "6px 14px",
                    borderRadius: 6,
                    fontFamily: "Inter, sans-serif",
                    fontWeight: 500,
                    fontSize: 13,
                    color: active ? "rgb(var(--cn-ink))" : "rgb(var(--cn-muted))",
                    background: active ? "rgb(var(--cn-card2))" : "transparent",
                    border: "none",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    transition: "all 0.15s",
                  }}
                  onMouseEnter={(e) => {
                    if (!active)
                      (e.currentTarget as HTMLButtonElement).style.color =
                        "rgb(var(--cn-ink2))";
                  }}
                  onMouseLeave={(e) => {
                    if (!active)
                      (e.currentTarget as HTMLButtonElement).style.color =
                        "rgb(var(--cn-muted))";
                  }}
                >
                  {v === "kanban" ? (
                    <LayoutGrid style={{ width: 14, height: 14 }} />
                  ) : (
                    <Table style={{ width: 14, height: 14 }} />
                  )}
                  {v === "kanban" ? "Kanban" : "Tabela"}
                </button>
              );
            })}
          </div>

          {/* New task button */}
          <button
            type="button"
            onClick={onNewTask}
            style={{
              background: "#6C5CE7",
              color: "#FFFFFF",
              border: "none",
              borderRadius: 999,
              padding: "10px 22px",
              fontFamily: "'Plus Jakarta Sans', sans-serif",
              fontWeight: 700,
              fontSize: 14,
              display: "flex",
              alignItems: "center",
              gap: 8,
              cursor: "pointer",
              transition: "background 0.15s, transform 0.1s",
            }}
            onMouseEnter={(e) =>
              ((e.currentTarget as HTMLButtonElement).style.background =
                "#5A4BD1")
            }
            onMouseLeave={(e) =>
              ((e.currentTarget as HTMLButtonElement).style.background =
                "#6C5CE7")
            }
            onMouseDown={(e) =>
              ((e.currentTarget as HTMLButtonElement).style.transform =
                "scale(0.97)")
            }
            onMouseUp={(e) =>
              ((e.currentTarget as HTMLButtonElement).style.transform =
                "scale(1)")
            }
          >
            <Plus style={{ width: 16, height: 16 }} />
            Nova Tarefa
          </button>
        </div>
      </div>
    </div>
  );
}
