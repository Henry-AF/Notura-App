"use client";

import React from "react";
import Link from "next/link";

export interface SidebarPlanWidgetProps {
  planName: string;
  used: number;
  total: number;
}

export function SidebarPlanWidget({ planName, used, total }: SidebarPlanWidgetProps) {
  const pct = total > 0 ? Math.min((used / total) * 100, 100) : 0;

  return (
    <div
      style={{
        background: "#1A1A1A",
        border: "1px solid #2E2E2E",
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
          color: "#A0A0A0",
          marginBottom: "8px",
        }}
      >
        {planName}
      </p>

      {/* Progress bar */}
      <div
        style={{
          height: 4,
          background: "#2E2E2E",
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

      {/* CTA */}
      <Link
        href="/pricing"
        style={{
          fontFamily: "Inter, sans-serif",
          fontWeight: 600,
          fontSize: "12px",
          color: "#A29BFE",
          textDecoration: "none",
          transition: "color 0.15s",
        }}
        onMouseEnter={(e) =>
          ((e.currentTarget as HTMLAnchorElement).style.color = "#FFFFFF")
        }
        onMouseLeave={(e) =>
          ((e.currentTarget as HTMLAnchorElement).style.color = "#A29BFE")
        }
      >
        Upgrade para ilimitado
      </Link>
    </div>
  );
}
