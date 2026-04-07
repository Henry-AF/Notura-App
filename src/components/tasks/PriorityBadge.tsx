"use client";

import React from "react";

export interface PriorityBadgeProps {
  priority: "alta" | "media" | "baixa";
}

const PRIORITY_MAP = {
  alta: {
    label: "ALTA",
    background: "rgba(255,107,107,0.15)",
    color: "#FF6B6B",
  },
  media: {
    label: "MÉDIA",
    background: "rgba(255,169,77,0.15)",
    color: "#FFA94D",
  },
  baixa: {
    label: "BAIXA",
    background: "rgba(78,203,113,0.15)",
    color: "#4ECB71",
  },
} as const;

export function PriorityBadge({ priority }: PriorityBadgeProps) {
  const { label, background, color } = PRIORITY_MAP[priority];
  return (
    <span
      style={{
        padding: "3px 10px",
        borderRadius: 4,
        fontFamily: "Inter, sans-serif",
        fontWeight: 700,
        fontSize: 10,
        textTransform: "uppercase",
        letterSpacing: "0.06em",
        background,
        color,
        display: "inline-block",
      }}
    >
      {label}
    </span>
  );
}
