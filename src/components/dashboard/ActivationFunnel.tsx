import React from "react";
import type { ActivationMetrics } from "@/lib/activation";

function formatMedian(minutes: number | null): string {
  if (minutes === null) return "—";
  if (minutes < 60) return `${Math.round(minutes)} min`;
  return `${(minutes / 60).toFixed(1)} h`;
}

export function ActivationFunnel({ metrics }: { metrics: ActivationMetrics }) {
  const gates = [
    ["Cadastros", metrics.signupCount, null],
    ["1ª gravação", metrics.recordingCount, metrics.signupToRecordingPct],
    ["1ª ata entregue", metrics.deliveredCount, metrics.recordingToDeliveredPct],
    ["1ª ata visualizada", metrics.viewedCount, metrics.deliveredToViewedPct],
  ] as const;

  return (
    <section className="mt-6 rounded-2xl bg-card p-5 shadow-[0_2px_8px_rgba(0,0,0,0.06)]">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Coorte desta semana</p>
          <h2 className="mt-1 text-lg font-bold text-foreground">Funil de ativação</h2>
        </div>
        <div className="text-right text-sm text-muted-foreground">
          <strong className="block text-2xl text-foreground">{metrics.activationRatePct}%</strong>
          ativação · mediana {formatMedian(metrics.medianActivationMinutes)}
        </div>
      </div>
      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {gates.map(([label, count, conversion]) => (
          <div key={label} className="rounded-xl border border-border bg-background/60 p-4">
            <p className="text-sm text-muted-foreground">{label}</p>
            <p className="mt-1 text-2xl font-extrabold text-foreground">{count}</p>
            {conversion !== null && <p className="mt-1 text-xs font-semibold text-primary">{conversion}% do gate anterior</p>}
          </div>
        ))}
      </div>
      <p className="mt-4 text-xs text-muted-foreground">
        Ativações por entrega: {metrics.inAppActivations} in-app · {metrics.whatsappActivations} WhatsApp
      </p>
    </section>
  );
}
