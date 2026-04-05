import React from "react";
import { Check } from "lucide-react";

export interface SubscriptionCardProps {
  planName: string;
  meetingsUsed: number;
  meetingsTotal: number;
  renewsInDays: number;
  onChangePlan: () => void;
}

export function SubscriptionCard({
  planName,
  meetingsUsed,
  meetingsTotal,
  renewsInDays,
  onChangePlan,
}: SubscriptionCardProps) {
  const pct = Math.min(100, Math.round((meetingsUsed / meetingsTotal) * 100));

  return (
    <div
      className="flex flex-col rounded-2xl border p-6"
      style={{ background: "#1C1C1C", borderColor: "#2E2E2E" }}
    >
      {/* Label */}
      <p
        style={{
          fontSize: "10px",
          fontWeight: 700,
          textTransform: "uppercase",
          letterSpacing: "0.12em",
          color: "#606060",
        }}
      >
        Assinatura Atual
      </p>

      {/* Plan name + badge */}
      <div className="mt-2 flex items-center justify-between gap-3">
        <p className="font-display text-xl font-bold text-white">{planName}</p>
        <div
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full"
          style={{ background: "#6851FF" }}
        >
          <Check className="h-3.5 w-3.5 text-white" strokeWidth={3} />
        </div>
      </div>

      {/* Usage */}
      <div className="mt-5">
        <div className="flex items-center justify-between text-[13px]">
          <span className="text-[#A0A0A0]">Reuniões usadas</span>
          <span className="font-semibold text-white">
            {meetingsUsed}/{meetingsTotal}
          </span>
        </div>

        {/* Progress bar */}
        <div
          className="mt-2 overflow-hidden rounded-full"
          style={{ height: "6px", background: "#2E2E2E" }}
        >
          <div
            style={{
              width: `${pct}%`,
              height: "100%",
              background: "#6851FF",
              borderRadius: "999px",
              transition: "width 0.6s ease",
            }}
          />
        </div>

        <p className="mt-1.5 text-right text-[11px] text-[#606060]">
          Renova em {renewsInDays} dias
        </p>
      </div>

      {/* CTA */}
      <button
        type="button"
        onClick={onChangePlan}
        className="mt-5 w-full rounded-full py-3 font-display text-sm font-bold text-white transition-colors active:scale-[0.98]"
        style={{ background: "#6851FF" }}
        onMouseEnter={(e) =>
          ((e.currentTarget as HTMLButtonElement).style.background = "#5740EE")
        }
        onMouseLeave={(e) =>
          ((e.currentTarget as HTMLButtonElement).style.background = "#6851FF")
        }
      >
        Mudar plano
      </button>
    </div>
  );
}
