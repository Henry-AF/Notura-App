import React from "react";
import { BarChart2 } from "lucide-react";

interface PlanBadgeProps {
  used: number;
  total: number;
}

export function PlanBadge({ used, total }: PlanBadgeProps) {
  const remaining = total - used;

  return (
    <div
      className="flex items-start gap-3 rounded-xl border p-[14px_16px]"
      style={{ background: "rgb(var(--cn-card))", borderColor: "rgb(var(--cn-border))" }}
    >
      {/* Icon */}
      <div
        className="flex h-8 w-8 shrink-0 items-center justify-center"
        style={{ background: "rgba(104,81,255,0.12)", borderRadius: "8px" }}
      >
        <BarChart2 className="h-4 w-4 text-[#6851FF]" />
      </div>

      {/* Text */}
      <div>
        <p
          style={{
            fontSize: "10px",
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "0.1em",
            color: "rgb(var(--cn-muted))",
          }}
        >
          Uso do Plano
        </p>
        <p className="mt-0.5 text-[13px] font-medium leading-snug" style={{ color: "rgb(var(--cn-ink2))" }}>
          Você ainda tem{" "}
          <span className="font-semibold text-[#8B7AFF]">
            {remaining} reuniões
          </span>{" "}
          este mês.
        </p>
      </div>
    </div>
  );
}
