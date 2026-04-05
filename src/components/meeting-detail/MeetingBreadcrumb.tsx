"use client";

import React from "react";

export interface MeetingBreadcrumbProps {
  clientName: string;
  onBack: () => void;
}

export function MeetingBreadcrumb({ clientName, onBack }: MeetingBreadcrumbProps) {
  return (
    <div style={{ marginBottom: 12, display: "flex", alignItems: "center" }}>
      <button
        type="button"
        onClick={onBack}
        style={{
          background: "none",
          border: "none",
          padding: 0,
          cursor: "pointer",
          fontFamily: "Inter, sans-serif",
          fontWeight: 500,
          fontSize: 11,
          color: "rgb(var(--cn-muted))",
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          transition: "color 0.15s",
        }}
        onMouseEnter={(e) =>
          ((e.currentTarget as HTMLButtonElement).style.color = "rgb(var(--cn-ink2))")
        }
        onMouseLeave={(e) =>
          ((e.currentTarget as HTMLButtonElement).style.color = "rgb(var(--cn-muted))")
        }
      >
        Reuniões
      </button>
      <span
        style={{
          fontFamily: "Inter, sans-serif",
          fontWeight: 400,
          fontSize: 11,
          color: "rgb(var(--cn-border))",
          margin: "0 8px",
        }}
      >
        /
      </span>
      <span
        style={{
          fontFamily: "Inter, sans-serif",
          fontWeight: 600,
          fontSize: 11,
          color: "rgb(var(--cn-ink))",
          textTransform: "uppercase",
          letterSpacing: "0.08em",
        }}
      >
        {clientName}
      </span>
    </div>
  );
}
