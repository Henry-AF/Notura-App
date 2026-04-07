"use client";

import React from "react";

export interface ProgressBarProps {
  value: number; // 0–100
}

export function ProgressBar({ value }: ProgressBarProps) {
  const clamped = Math.max(0, Math.min(100, value));
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        marginTop: 12,
      }}
    >
      <div
        style={{
          flex: 1,
          height: 5,
          background: "rgb(var(--cn-border))",
          borderRadius: 999,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            height: "100%",
            width: `${clamped}%`,
            background: "#6C5CE7",
            borderRadius: 999,
            transition: "width 0.4s ease-out",
          }}
        />
      </div>
      <span
        style={{
          fontFamily: "Inter, sans-serif",
          fontWeight: 600,
          fontSize: 11,
          color: "#A0A0A0",
          whiteSpace: "nowrap",
        }}
      >
        {clamped}%
      </span>
    </div>
  );
}
