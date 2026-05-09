"use client";

import React from "react";
import { MetricCard, MetricCardProps } from "./MetricCard";

interface MetricsRowProps {
  metrics: MetricCardProps[];
}

export function MetricsRow({ metrics }: MetricsRowProps) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 2xl:grid-cols-4">
      {metrics.map((m, i) => (
        <MetricCard key={i} {...m} />
      ))}
    </div>
  );
}
