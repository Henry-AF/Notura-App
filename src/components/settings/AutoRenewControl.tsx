"use client";

import React from "react";
import { Clock3, Loader2, RefreshCcw } from "lucide-react";
import { useThemeColors } from "@/lib/theme-context";
import type { Plan } from "@/types/database";
import { SettingsToggle } from "./SettingsToggle";

export type SubscriptionStatus = "free" | "active" | "expired" | "grace";

const PERIOD_END_FORMATTER = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  timeZone: "UTC",
});

export interface AutoRenewControlProps {
  plan: Plan;
  currentPeriodEnd: string | null;
  autoRenewEnabled: boolean;
  renewalStatus: string;
  subscriptionStatus?: SubscriptionStatus;
  pending?: boolean;
  onChange: (enabled: boolean) => void;
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
  plan: Plan,
  currentPeriodEnd: string | null,
  renewalStatus: string,
  subscriptionStatus: SubscriptionStatus | undefined
): SubscriptionStatus {
  if (subscriptionStatus) return subscriptionStatus;
  if (plan === "free") return "free";
  if (!isPeriodExpired(currentPeriodEnd)) return "active";
  return renewalStatus === "retrying" ? "grace" : "expired";
}

function getDescription(
  autoRenewEnabled: boolean,
  renewalStatus: string,
  currentPeriodEnd: string | null,
  subscriptionStatus: SubscriptionStatus
) {
  if (renewalStatus === "suspended") {
    return "Renovação suspensa após tentativas sem sucesso.";
  }

  const formattedDate = formatPeriodEnd(currentPeriodEnd);
  if (subscriptionStatus === "expired") {
    return formattedDate
      ? `Assinatura vencida em ${formattedDate}.`
      : "Assinatura vencida.";
  }

  if (subscriptionStatus === "grace") {
    return formattedDate
      ? `Estamos tentando renovar sua assinatura desde ${formattedDate}.`
      : "Estamos tentando renovar sua assinatura.";
  }

  if (!formattedDate) {
    return "Renovação vinculada ao ciclo atual.";
  }

  if (autoRenewEnabled) {
    return `Próxima renovação em ${formattedDate}.`;
  }

  return `Plano ativo até ${formattedDate}.`;
}

function getTitle(
  autoRenewEnabled: boolean,
  subscriptionStatus: SubscriptionStatus
): string {
  if (subscriptionStatus === "expired") return "Assinatura vencida";
  if (subscriptionStatus === "grace") return "Renovação em processamento";
  return autoRenewEnabled
    ? "Renovação automática ativa"
    : "Renovação automática desativada";
}

export function AutoRenewControl({
  plan,
  currentPeriodEnd,
  autoRenewEnabled,
  renewalStatus,
  subscriptionStatus,
  pending = false,
  onChange,
}: AutoRenewControlProps) {
  const c = useThemeColors();

  if (plan === "free") {
    return null;
  }

  const resolvedStatus = resolveSubscriptionStatus(
    plan,
    currentPeriodEnd,
    renewalStatus,
    subscriptionStatus
  );
  const disabled =
    pending ||
    renewalStatus === "suspended" ||
    resolvedStatus === "expired" ||
    resolvedStatus === "grace";
  const title = getTitle(autoRenewEnabled, resolvedStatus);
  const description = getDescription(
    autoRenewEnabled,
    renewalStatus,
    currentPeriodEnd,
    resolvedStatus
  );

  return (
    <div
      className="flex items-center gap-3 rounded-xl border p-4"
      style={{ background: c.card2, borderColor: c.border }}
    >
      <div
        className="flex size-10 shrink-0 items-center justify-center rounded-lg"
        style={{
          background: autoRenewEnabled
            ? "rgba(104,81,255,0.14)"
            : "rgba(136,134,160,0.14)",
          color: autoRenewEnabled ? "#6851FF" : c.ink3,
        }}
      >
        {pending ? (
          <Loader2 className="size-4 animate-spin" />
        ) : autoRenewEnabled ? (
          <RefreshCcw className="size-4" />
        ) : (
          <Clock3 className="size-4" />
        )}
      </div>

      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold" style={{ color: c.ink }}>
          {title}
        </p>
        <p className="mt-0.5 text-xs" style={{ color: c.ink3 }}>
          {description}
        </p>
      </div>

      <SettingsToggle
        checked={autoRenewEnabled}
        disabled={disabled}
        ariaLabel={
          autoRenewEnabled
            ? "Desativar renovação automática"
            : "Ativar renovação automática"
        }
        onChange={onChange}
      />
    </div>
  );
}
