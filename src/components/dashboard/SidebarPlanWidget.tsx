"use client";

import React from "react";

export interface SidebarPlanWidgetProps {
  planName: string;
  used: number;
  total: number | null;
  onUpgradeClick?: () => void;
}

export function SidebarPlanWidget({ planName, used, total, onUpgradeClick }: SidebarPlanWidgetProps) {
  const pct =
    typeof total === "number" && total > 0
      ? Math.min((used / total) * 100, 100)
      : null;

  return (
    <div
      style={{
        background: "rgb(var(--cn-card))",
        border: "1px solid rgb(var(--cn-border))",
        borderRadius: "10px",
        padding: "14px",
      }}
    >
      {/* Plan name */}
      <p
        style={{
          fontFamily: "Inter, sans-serif",
          fontWeight: 500,
          fontSize: "12px",
          color: "rgb(var(--cn-ink2))",
          marginBottom: "8px",
        }}
      >
        {planName}
      </p>

      {/* Progress bar */}
      {pct !== null ? (
        <div
          style={{
            height: 4,
            background: "rgb(var(--cn-border))",
            borderRadius: "999px",
            overflow: "hidden",
            marginBottom: "8px",
          }}
        >
          <div
            style={{
              width: `${pct}%`,
              height: "100%",
              background: "#6C5CE7",
              borderRadius: "999px",
              transition: "width 0.4s ease",
            }}
          />
        </div>
      ) : (
        <p
          style={{
            fontFamily: "Inter, sans-serif",
            fontSize: "11px",
            color: "rgb(var(--cn-ink2))",
            marginBottom: "8px",
          }}
        >
          Sem limite mensal
        </p>
      )}

      {/* CTA */}
      <button
        type="button"
        onClick={onUpgradeClick}
        style={{
          background: "none",
          border: "none",
          padding: 0,
          cursor: onUpgradeClick ? "pointer" : "default",
          fontFamily: "Inter, sans-serif",
          fontWeight: 600,
          fontSize: "12px",
          color: "#A29BFE",
          textDecoration: "none",
          transition: "color 0.15s",
        }}
        onMouseEnter={(e) =>
          ((e.currentTarget as HTMLButtonElement).style.color = "rgb(var(--cn-ink))")
        }
        onMouseLeave={(e) =>
          ((e.currentTarget as HTMLButtonElement).style.color = "#A29BFE")
        }
      >
        Upgrade para ilimitado
      </button>
    </div>
  );
}
