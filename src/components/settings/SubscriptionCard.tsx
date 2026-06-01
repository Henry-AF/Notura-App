"use client";

import React from "react";
import { Check } from "lucide-react";
import { useThemeColors } from "@/lib/theme-context";
import type { Plan } from "@/types/database";
import { AutoRenewControl, type SubscriptionStatus } from "./AutoRenewControl";

const PERIOD_END_FORMATTER = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  timeZone: "UTC",
});

export interface SubscriptionCardProps {
  plan?: Plan;
  planName: string;
  meetingsUsed: number;
  meetingsTotal: number | null;
  renewsInDays: number;
  currentPeriodEnd?: string | null;
  autoRenewEnabled?: boolean;
  renewalStatus?: string;
  subscriptionStatus?: SubscriptionStatus;
  autoRenewSaving?: boolean;
  onAutoRenewChange?: (enabled: boolean) => void;
  onChangePlan: () => void;
}

type ThemeColors = ReturnType<typeof useThemeColors>;

interface UsageSummaryProps {
  c: ThemeColors;
  meetingsUsed: number;
  meetingsTotal: number | null;
  renewsInDays: number;
  currentPeriodEnd: string | null;
  subscriptionStatus: SubscriptionStatus;
}

function formatPeriodEnd(value: string | null): string | null {
  if (!value) return null;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  return PERIOD_END_FORMATTER.format(date);
}

function isPeriodExpired(value: string | null): boolean {
  if (!value) return false;

  const date = new Date(value);
  return !Number.isNaN(date.getTime()) && date.getTime() <= Date.now();
}

function resolveSubscriptionStatus(
  plan: Plan | undefined,
  currentPeriodEnd: string | null,
  renewalStatus: string,
  subscriptionStatus: SubscriptionStatus | undefined
): SubscriptionStatus {
  if (subscriptionStatus) return subscriptionStatus;
  if (!plan || plan === "free") return "free";
  if (!isPeriodExpired(currentPeriodEnd)) return "active";
  return renewalStatus === "retrying" ? "grace" : "expired";
}

function getUsageFooter(
  meetingsTotal: number | null,
  renewsInDays: number,
  currentPeriodEnd: string | null,
  subscriptionStatus: SubscriptionStatus
): string {
  if (subscriptionStatus === "expired") {
    const formattedDate = formatPeriodEnd(currentPeriodEnd);
    return formattedDate
      ? `Assinatura vencida em ${formattedDate}`
      : "Assinatura vencida";
  }

  if (subscriptionStatus === "grace") {
    return "Renovação em processamento";
  }

  return meetingsTotal === null
    ? "Limite personalizado"
    : `Renova em ${renewsInDays} dias`;
}

function SubscriptionLabel({ c }: { c: ThemeColors }) {
  return (
    <p
      style={{
        fontSize: "12px",
        fontWeight: 700,
        textTransform: "uppercase",
        letterSpacing: "0.12em",
        color: c.ink3,
      }}
    >
      Assinatura Atual
    </p>
  );
}

function PlanHeader({
  c,
  planName,
}: {
  c: ThemeColors;
  planName: string;
}) {
  return (
    <div className="mt-2 flex items-center justify-between gap-3">
      <p className="font-display text-xl font-bold" style={{ color: c.ink }}>
        {planName}
      </p>
      <div
        className="flex size-7 shrink-0 items-center justify-center rounded-full"
        style={{ background: "#6851FF" }}
      >
        <Check className="size-3.5 text-white" strokeWidth={3} />
      </div>
    </div>
  );
}

function UsageSummary({
  c,
  meetingsUsed,
  meetingsTotal,
  renewsInDays,
  currentPeriodEnd,
  subscriptionStatus,
}: UsageSummaryProps) {
  const pct =
    typeof meetingsTotal === "number" && meetingsTotal > 0
      ? Math.min(100, Math.round((meetingsUsed / meetingsTotal) * 100))
      : null;

  return (
    <div className="mt-5">
      <div className="flex items-center justify-between text-[13px]">
        <span style={{ color: c.ink2 }}>Reuniões usadas</span>
        <span className="font-semibold" style={{ color: c.ink }}>
          {meetingsTotal === null
            ? `${meetingsUsed}/Personalizado`
            : `${meetingsUsed}/${meetingsTotal}`}
        </span>
      </div>

      {pct !== null && (
        <div
          className="mt-2 overflow-hidden rounded-full"
          style={{ height: "6px", background: c.border }}
        >
          <div
            style={{
              width: "100%",
              height: "100%",
              background: "#6851FF",
              borderRadius: "999px",
              transform: `scaleX(${pct / 100})`,
              transformOrigin: "left",
              transition: "transform 0.6s ease",
            }}
          />
        </div>
      )}

      <p className="mt-1.5 text-right text-[11px]" style={{ color: c.ink3 }}>
        {getUsageFooter(
          meetingsTotal,
          renewsInDays,
          currentPeriodEnd,
          subscriptionStatus
        )}
      </p>
    </div>
  );
}

function ChangePlanButton({ onChangePlan }: { onChangePlan: () => void }) {
  return (
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
  );
}

export function SubscriptionCard({
  plan,
  planName,
  meetingsUsed,
  meetingsTotal,
  renewsInDays,
  currentPeriodEnd = null,
  autoRenewEnabled = true,
  renewalStatus = "idle",
  subscriptionStatus,
  autoRenewSaving = false,
  onAutoRenewChange,
  onChangePlan,
}: SubscriptionCardProps) {
  const c = useThemeColors();
  const resolvedStatus = resolveSubscriptionStatus(
    plan,
    currentPeriodEnd,
    renewalStatus,
    subscriptionStatus
  );

  return (
    <div
      className="flex flex-col rounded-2xl border p-6"
      style={{ background: c.card, borderColor: c.border }}
    >
      <SubscriptionLabel c={c} />
      <PlanHeader c={c} planName={planName} />
      <UsageSummary
        c={c}
        meetingsUsed={meetingsUsed}
        meetingsTotal={meetingsTotal}
        renewsInDays={renewsInDays}
        currentPeriodEnd={currentPeriodEnd}
        subscriptionStatus={resolvedStatus}
      />

      {plan && onAutoRenewChange && (
        <div className="mt-4">
          <AutoRenewControl
            plan={plan}
            currentPeriodEnd={currentPeriodEnd}
            autoRenewEnabled={autoRenewEnabled}
            renewalStatus={renewalStatus}
            subscriptionStatus={resolvedStatus}
            pending={autoRenewSaving}
            onChange={onAutoRenewChange}
          />
        </div>
      )}

      <ChangePlanButton onChangePlan={onChangePlan} />
    </div>
  );
}
