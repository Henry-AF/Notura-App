"use client";

import React from "react";
import { Star } from "lucide-react";

export interface KeyDecisionCardProps {
  decision: string;
}

export function KeyDecisionCard({ decision }: KeyDecisionCardProps) {
  return (
    <div
      style={{
        background: "rgb(var(--cn-card))",
        border: "1px solid rgb(var(--cn-border))",
        borderRadius: 14,
        padding: 20,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          marginBottom: 12,
        }}
      >
        <Star
          style={{ width: 14, height: 14, color: "#FFA94D", flexShrink: 0 }}
        />
        <span
          style={{
            fontFamily: "Inter, sans-serif",
            fontWeight: 700,
            fontSize: 10,
            color: "rgb(var(--cn-muted))",
            textTransform: "uppercase",
            letterSpacing: "0.1em",
          }}
        >
          Decisão Chave
        </span>
      </div>
      <p
        style={{
          fontFamily: "'Plus Jakarta Sans', sans-serif",
          fontWeight: 600,
          fontSize: 16,
          color: "rgb(var(--cn-ink))",
          lineHeight: 1.4,
          margin: 0,
        }}
      >
        {decision}
      </p>
    </div>
  );
}
