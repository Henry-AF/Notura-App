"use client";

import React from "react";

export interface InsightCardProps {
  title: string;
  body: string;
}

export function InsightCard({ title, body }: InsightCardProps) {
  return (
    <div
      style={{
        background: "#1C1C1C",
        border: "1px solid #2E2E2E",
        borderRadius: "14px",
        padding: "20px",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Decorative ✦ */}
      <span
        aria-hidden
        style={{
          position: "absolute",
          top: 16,
          right: 16,
          fontSize: "32px",
          color: "#2E2E2E",
          opacity: 0.6,
          pointerEvents: "none",
          userSelect: "none",
        }}
      >
        ✦
      </span>

      {/* Label row */}
      <div className="flex items-center gap-1.5">
        <span style={{ color: "#FFA94D", fontSize: "14px" }}>⚡</span>
        <span
          style={{
            fontSize: "9px",
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "0.12em",
            color: "#FFA94D",
            fontFamily: "Inter, sans-serif",
          }}
        >
          Insight da Notura
        </span>
      </div>

      {/* Title */}
      <p
        style={{
          fontFamily: "'Plus Jakarta Sans', sans-serif",
          fontWeight: 700,
          fontSize: "17px",
          color: "#FFFFFF",
          lineHeight: 1.3,
          margin: "10px 0 8px",
        }}
      >
        {title}
      </p>

      {/* Body */}
      <p
        style={{
          fontFamily: "Inter, sans-serif",
          fontWeight: 400,
          fontSize: "13px",
          color: "#A0A0A0",
          lineHeight: 1.7,
          margin: 0,
        }}
      >
        {body}
      </p>
    </div>
  );
}
