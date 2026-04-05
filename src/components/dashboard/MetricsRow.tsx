"use client";

import React from "react";
import { MetricCard, MetricCardProps } from "./MetricCard";

interface MetricsRowProps {
  metrics: MetricCardProps[];
}

export function MetricsRow({ metrics }: MetricsRowProps) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
        gap: "16px",
      }}
    >
      {metrics.map((m, i) => (
        <MetricCard key={i} {...m} />
      ))}
    </div>
  );
}
