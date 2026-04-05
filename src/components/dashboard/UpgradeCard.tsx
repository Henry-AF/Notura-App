"use client";

import React from "react";
import { ArrowRight } from "lucide-react";

export interface UpgradeCardProps {
  onViewPlans: () => void;
  planName: string;
}

export function UpgradeCard({ onViewPlans, planName }: UpgradeCardProps) {
  return (
    <div
      style={{
        background: "#6C5CE7",
        borderRadius: "16px",
        padding: "24px",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Decorative large ✦ */}
      <span
        aria-hidden
        style={{
          position: "absolute",
          bottom: 16,
          right: 16,
          fontSize: "64px",
          color: "rgba(255,255,255,0.1)",
          transform: "rotate(15deg)",
          pointerEvents: "none",
          userSelect: "none",
          lineHeight: 1,
        }}
      >
        ✦
      </span>

      {/* Title */}
      <p
        style={{
          fontFamily: "'Plus Jakarta Sans', sans-serif",
          fontWeight: 800,
          fontSize: "22px",
          color: "#FFFFFF",
          lineHeight: 1.2,
          margin: 0,
        }}
      >
        Expanda sua
        <br />
        inteligência
      </p>

      {/* Body */}
      <p
        style={{
          fontFamily: "Inter, sans-serif",
          fontWeight: 400,
          fontSize: "13px",
          color: "rgba(255,255,255,0.8)",
          lineHeight: 1.6,
          margin: "10px 0 20px",
        }}
      >
        Você está no {planName}. Upgrade para ilimitado e desbloqueie
        transcrições infinitas e análises avançadas.
      </p>

      {/* CTA */}
      <button
        type="button"
        onClick={onViewPlans}
        className="inline-flex items-center gap-1.5"
        style={{
          background: "#FFFFFF",
          color: "#6C5CE7",
          borderRadius: "999px",
          padding: "10px 20px",
          fontFamily: "'Plus Jakarta Sans', sans-serif",
          fontWeight: 700,
          fontSize: "13px",
          border: "none",
          cursor: "pointer",
          transition: "background 0.15s",
        }}
        onMouseEnter={(e) =>
          ((e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.9)")
        }
        onMouseLeave={(e) =>
          ((e.currentTarget as HTMLButtonElement).style.background = "#FFFFFF")
        }
      >
        Ver Planos
        <ArrowRight style={{ width: 14, height: 14 }} />
      </button>
    </div>
  );
}
