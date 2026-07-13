"use client";

import React from "react";
import type { TaskLabel } from "./TaskCard";

export interface LabelBadgeProps {
  label: TaskLabel;
  onRemove?: () => void;
}

export function LabelBadge({ label, onRemove }: LabelBadgeProps) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        fontFamily: "Inter, sans-serif",
        fontSize: 11,
        fontWeight: 600,
        color: label.color,
        background: `${label.color}1A`,
        padding: onRemove ? "2px 4px 2px 7px" : "2px 7px",
        borderRadius: 4,
      }}
    >
      {label.name}
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Remover label ${label.name}`}
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            color: label.color,
            opacity: 0.7,
            padding: 0,
            lineHeight: 1,
            fontSize: 13,
            display: "flex",
            alignItems: "center",
          }}
        >
          ×
        </button>
      )}
    </span>
  );
}
