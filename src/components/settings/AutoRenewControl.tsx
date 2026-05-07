"use client";

import React from "react";
import { Clock3, Loader2, RefreshCcw } from "lucide-react";
import { useThemeColors } from "@/lib/theme-context";
import type { Plan } from "@/types/database";
import { SettingsToggle } from "./SettingsToggle";

export interface AutoRenewControlProps {
  plan: Plan;
  currentPeriodEnd: string | null;
  autoRenewEnabled: boolean;
  renewalStatus: string;
  pending?: boolean;
  onChange: (enabled: boolean) => void;
}

function formatPeriodEnd(value: string | null): string | null {
  if (!value) return null;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

function getDescription(
  autoRenewEnabled: boolean,
  renewalStatus: string,
  currentPeriodEnd: string | null
) {
  if (renewalStatus === "suspended") {
    return "Renovação suspensa após tentativas sem sucesso.";
  }

  const formattedDate = formatPeriodEnd(currentPeriodEnd);
  if (!formattedDate) {
    return "Renovação vinculada ao ciclo atual.";
  }

  if (autoRenewEnabled) {
    return `Próxima renovação em ${formattedDate}.`;
  }

  return `Plano ativo até ${formattedDate}.`;
}

export function AutoRenewControl({
  plan,
  currentPeriodEnd,
  autoRenewEnabled,
  renewalStatus,
  pending = false,
  onChange,
}: AutoRenewControlProps) {
  const c = useThemeColors();

  if (plan === "free") {
    return null;
  }

  const disabled = pending || renewalStatus === "suspended";
  const title = autoRenewEnabled
    ? "Renovação automática ativa"
    : "Renovação automática desativada";
  const description = getDescription(
    autoRenewEnabled,
    renewalStatus,
    currentPeriodEnd
  );

  return (
    <div
      className="flex items-center gap-3 rounded-xl border p-4"
      style={{ background: c.card2, borderColor: c.border }}
    >
      <div
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg"
        style={{
          background: autoRenewEnabled
            ? "rgba(104,81,255,0.14)"
            : "rgba(136,134,160,0.14)",
          color: autoRenewEnabled ? "#6851FF" : c.ink3,
        }}
      >
        {pending ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : autoRenewEnabled ? (
          <RefreshCcw className="h-4 w-4" />
        ) : (
          <Clock3 className="h-4 w-4" />
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
