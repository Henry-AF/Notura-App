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
        background: "#1C1C1C",
        border: "1px solid #2E2E2E",
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
            color: "#606060",
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
          color: "#FFFFFF",
          lineHeight: 1.4,
          margin: 0,
        }}
      >
        {decision}
      </p>
    </div>
  );
}
