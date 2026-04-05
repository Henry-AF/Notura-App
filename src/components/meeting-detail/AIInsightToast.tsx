"use client";

import React from "react";

export interface AIInsightToastProps {
  userInitials: string;
  message: string;
}

export function AIInsightToast({ userInitials, message }: AIInsightToastProps) {
  return (
    <div
      style={{
        position: "fixed",
        bottom: 80,
        left: 8,
        width: 224,
        background: "#1A1A2E",
        border: "1px solid rgba(108,92,231,0.3)",
        borderRadius: 10,
        padding: "12px 14px",
        zIndex: 30,
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          marginBottom: 6,
        }}
      >
        <span style={{ fontSize: 12, color: "#6C5CE7", lineHeight: 1 }}>✦</span>
        <span
          style={{
            fontFamily: "Inter, sans-serif",
            fontWeight: 700,
            fontSize: 10,
            color: "#A29BFE",
            letterSpacing: "0.06em",
            textTransform: "uppercase",
          }}
        >
          AI Insight {userInitials}
        </span>
      </div>

      {/* Body */}
      <p
        style={{
          fontFamily: "Inter, sans-serif",
          fontWeight: 400,
          fontSize: 12,
          color: "#A0A0A0",
          lineHeight: 1.5,
          margin: 0,
        }}
      >
        {message}
      </p>
    </div>
  );
}
