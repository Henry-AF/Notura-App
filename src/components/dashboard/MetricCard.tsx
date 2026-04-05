"use client";

import React, { useEffect, useState } from "react";

// ─── useCountUp hook ──────────────────────────────────────────────────────────

function useCountUp(target: number, duration = 800): number {
  const [count, setCount] = useState(0);
  useEffect(() => {
    let start = 0;
    const step = target / (duration / 16);
    const timer = setInterval(() => {
      start = Math.min(start + step, target);
      setCount(Math.floor(start));
      if (start >= target) clearInterval(timer);
    }, 16);
    return () => clearInterval(timer);
  }, [target, duration]);
  return count;
}

// ─── MetricCard ───────────────────────────────────────────────────────────────

export interface MetricCardProps {
  icon: string;
  iconBg: string;
  iconColor: string;
  label: string;
  value: number | string;
  trend?: {
    direction: "up" | "down" | "neutral";
    label: string;
  };
}

function TrendBadge({ trend }: { trend: MetricCardProps["trend"] }) {
  if (!trend) return null;

  let bg: string;
  let color: string;
  let prefix = "";

  if (trend.direction === "up") {
    bg = "rgba(78,203,113,0.12)";
    color = "#4ECB71";
    prefix = "↑ ";
  } else if (trend.direction === "down") {
    bg = "rgba(255,107,107,0.12)";
    color = "#FF6B6B";
    prefix = "↓ ";
  } else {
    bg = "rgba(255,169,77,0.12)";
    color = "#FFA94D";
  }

  return (
    <span
      style={{
        background: bg,
        color,
        borderRadius: "999px",
        padding: "3px 10px",
        fontSize: "11px",
        fontWeight: 700,
        whiteSpace: "nowrap",
      }}
    >
      {prefix}
      {trend.label}
    </span>
  );
}

export function MetricCard({
  icon,
  iconBg,
  iconColor,
  label,
  value,
  trend,
}: MetricCardProps) {
  const numericValue = typeof value === "number" ? value : NaN;
  const displayValue = isNaN(numericValue)
    ? (value as string)
    : // eslint-disable-next-line react-hooks/rules-of-hooks
      useCountUp(numericValue);

  return (
    <div
      style={{
        background: "#1C1C1C",
        border: "1px solid #2E2E2E",
        borderRadius: "14px",
        padding: "20px",
      }}
    >
      {/* Top row: icon + trend */}
      <div className="flex items-start justify-between">
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: 10,
            background: iconBg,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 18,
            color: iconColor,
          }}
        >
          {icon}
        </div>
        <TrendBadge trend={trend} />
      </div>

      {/* Label */}
      <p
        style={{
          fontFamily: "Inter, sans-serif",
          fontWeight: 400,
          fontSize: "13px",
          color: "#A0A0A0",
          marginTop: "16px",
          marginBottom: "4px",
        }}
      >
        {label}
      </p>

      {/* Value */}
      <p
        style={{
          fontFamily: "'Plus Jakarta Sans', sans-serif",
          fontWeight: 800,
          fontSize: "36px",
          color: "#FFFFFF",
          lineHeight: 1,
        }}
      >
        {typeof displayValue === "number" ? displayValue : value}
      </p>
    </div>
  );
}
