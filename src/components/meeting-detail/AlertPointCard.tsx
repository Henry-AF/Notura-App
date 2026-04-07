"use client";

import React from "react";
import { AlertCircle } from "lucide-react";

export interface AlertPointCardProps {
  alert: string;
}

export function AlertPointCard({ alert }: AlertPointCardProps) {
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
        <AlertCircle
          style={{ width: 14, height: 14, color: "#FF6B6B", flexShrink: 0 }}
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
          Ponto de Alerta
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
        {alert}
      </p>
    </div>
  );
}
