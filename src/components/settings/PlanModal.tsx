"use client";

import React, { useEffect, useRef, useState } from "react";
import { Check, X, Zap, Users, Sparkles, Loader2 } from "lucide-react";
import {
  APP_PLAN_IDS,
  getPlanDisplayName,
  getPlanMonthlyLimit,
  getPlanPriceLabel,
} from "@/lib/plans";
import { useThemeColors } from "@/lib/theme-context";
import type { Plan } from "@/types/database";

// ─── Plan definitions ─────────────────────────────────────────────────────────

interface PlanDef {
  id: Plan;
  name: string;
  price: string;
  period: string;
  badge?: string;
  badgeColor?: string;
  icon: React.ElementType;
  iconColor: string;
  iconBg: string;
  features: string[];
  cta: string;
  highlight?: boolean;
}

function getPlanUsageFeature(planId: Plan): string {
  const monthlyLimit = getPlanMonthlyLimit(planId);
  return monthlyLimit === null
    ? "Reuniões ilimitadas por mês"
    : `Até ${monthlyLimit} reuniões por mês`;
}

const PLAN_STYLE: Record<
  Plan,
  Pick<PlanDef, "icon" | "iconColor" | "iconBg" | "badge" | "badgeColor" | "highlight">
> = {
  free: {
    icon: Sparkles,
    iconColor: "#9598A8",
    iconBg: "rgba(149,152,168,0.12)",
  },
  pro: {
    icon: Zap,
    iconColor: "#6851FF",
    iconBg: "rgba(104,81,255,0.15)",
    badge: "Mais popular",
    badgeColor: "#6851FF",
    highlight: true,
  },
  team: {
    icon: Users,
    iconColor: "#E91E8C",
    iconBg: "rgba(233,30,140,0.12)",
  },
};

const PLAN_EXTRA_FEATURES: Record<Plan, string[]> = {
  free: [
    "Transcrição com IA",
    "Resumo automático",
    "Tarefas extraídas",
  ],
  pro: [
    "Resumo via WhatsApp",
    "Tarefas e decisões",
    "Exportação PDF",
    "Suporte prioritário",
  ],
  team: [
    "Tudo do plano Pro",
    "Uso sem limite de reuniões",
    "Suporte prioritário avançado",
  ],
};

const PLAN_CTA: Record<Plan, string> = {
  free: "Plano atual",
  pro: "Assinar Pro",
  team: "Assinar Platinum",
};

const PLANS: PlanDef[] = APP_PLAN_IDS.map((planId) => ({
  id: planId,
  name: getPlanDisplayName(planId),
  price: getPlanPriceLabel(planId),
  period: "/mês",
  features: [getPlanUsageFeature(planId), ...PLAN_EXTRA_FEATURES[planId]],
  cta: PLAN_CTA[planId],
  ...PLAN_STYLE[planId],
}));

// ─── Props ────────────────────────────────────────────────────────────────────

export interface PlanModalProps {
  currentPlan: string;
  onClose: () => void;
  onSuccess?: (plan: "pro" | "team") => void;
}

export interface CheckoutResponseBody {
  checkoutUrl?: string;
  alreadyActive?: boolean;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function PlanModal({ currentPlan, onClose, onSuccess }: PlanModalProps) {
  const c = useThemeColors();
  const [loading, setLoading] = useState<"pro" | "team" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // Escape key
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  async function handleSelectPlan(plan: "pro" | "team") {
    if (plan === currentPlan) {
      onClose();
      return;
    }
    setLoading(plan);
    setError(null);

    try {
      // Try AbacatePay first (Brazilian payment), fall back to Stripe
      let res = await fetch("/api/abacatepay/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
      });

      // If AbacatePay not configured, try Stripe
      if (res.status === 500 || res.status === 400) {
        const err = (await res.json().catch(() => ({}))) as { error?: string };
        if ((err.error ?? "").includes("ABACATEPAY") || (err.error ?? "").includes("Missing")) {
          res = await fetch("/api/stripe/checkout", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ plan }),
          });
        } else {
          throw new Error(err.error ?? "Erro ao iniciar checkout.");
        }
      }

      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? "Erro ao iniciar checkout.");
      }

      const body = (await res.json()) as CheckoutResponseBody;

      if (body.alreadyActive) {
        onSuccess?.(plan);
        onClose();
        return;
      }

      const redirectUrl = body.checkoutUrl;

      if (redirectUrl) {
        window.location.href = redirectUrl;
      } else {
        throw new Error("URL de checkout não recebida.");
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Erro inesperado. Tente novamente."
      );
      setLoading(null);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.75)", backdropFilter: "blur(4px)" }}
      onClick={onClose}
    >
      <div
        ref={panelRef}
        className="relative w-full max-w-3xl rounded-2xl"
        style={{
          background: c.card,
          border: `1px solid ${c.border}`,
          maxHeight: "90vh",
          overflowY: "auto",
          animation: "planModalIn 0.2s cubic-bezier(0.25, 0.46, 0.45, 0.94)",
        }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Escolher plano"
      >
        {/* Header */}
        <div
          className="sticky top-0 z-10 flex items-center justify-between p-6"
          style={{
            background: c.card,
            borderBottom: `1px solid ${c.border}`,
          }}
        >
          <div>
            <h2
              className="font-display text-xl font-bold"
              style={{ color: c.ink }}
            >
              Escolha seu plano
            </h2>
            <p className="mt-0.5 text-sm" style={{ color: c.ink2 }}>
              Atualize a qualquer momento. Cancele quando quiser.
            </p>
          </div>
          <button
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-full transition-colors"
            style={{ background: c.card2, color: c.ink3 }}
            onMouseEnter={(e) =>
              ((e.currentTarget as HTMLButtonElement).style.background = c.border)
            }
            onMouseLeave={(e) =>
              ((e.currentTarget as HTMLButtonElement).style.background = c.card2)
            }
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Plan cards */}
        <div className="grid gap-4 p-6 sm:grid-cols-3">
          {PLANS.map((plan) => {
            const isCurrentPlan =
              currentPlan === plan.id ||
              (currentPlan.toLowerCase().includes(plan.id) && plan.id !== "free");
            const isLoading = loading === plan.id;
            const isFree = plan.id === "free";

            return (
              <div
                key={plan.id}
                className="relative flex flex-col rounded-2xl p-5"
                style={{
                  background: plan.highlight ? "rgba(104,81,255,0.07)" : c.card2,
                  border: plan.highlight
                    ? "2px solid rgba(104,81,255,0.4)"
                    : `1px solid ${c.border}`,
                  transition: "transform 0.15s ease, box-shadow 0.15s ease",
                }}
                onMouseEnter={(e) => {
                  if (!isFree)
                    (e.currentTarget as HTMLDivElement).style.transform = "translateY(-2px)";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLDivElement).style.transform = "translateY(0)";
                }}
              >
                {/* Popular badge */}
                {plan.badge && (
                  <div
                    className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full px-3 py-0.5 text-[11px] font-bold text-white"
                    style={{ background: plan.badgeColor }}
                  >
                    {plan.badge}
                  </div>
                )}

                {/* Icon */}
                <div
                  className="flex h-10 w-10 items-center justify-center rounded-xl"
                  style={{ background: plan.iconBg }}
                >
                  <plan.icon className="h-5 w-5" style={{ color: plan.iconColor }} />
                </div>

                {/* Name + price */}
                <div className="mt-4">
                  <p
                    className="text-sm font-semibold"
                    style={{ color: c.ink2 }}
                  >
                    {plan.name}
                  </p>
                  <div className="mt-1 flex items-end gap-1">
                    <span
                      className="font-display text-3xl font-bold"
                      style={{ color: c.ink }}
                    >
                      {plan.price}
                    </span>
                    <span className="mb-1 text-sm" style={{ color: c.ink3 }}>
                      {plan.period}
                    </span>
                  </div>
                </div>

                {/* Features */}
                <ul className="mt-4 flex-1 space-y-2.5">
                  {plan.features.map((feat) => (
                    <li key={feat} className="flex items-start gap-2">
                      <Check
                        className="mt-0.5 h-3.5 w-3.5 shrink-0"
                        style={{
                          color: plan.highlight
                            ? "#6851FF"
                            : plan.id === "team"
                            ? "#E91E8C"
                            : "#4ECB71",
                        }}
                      />
                      <span
                        className="text-[13px] leading-snug"
                        style={{ color: c.ink2 }}
                      >
                        {feat}
                      </span>
                    </li>
                  ))}
                </ul>

                {/* CTA */}
                <button
                  type="button"
                  disabled={isFree || isCurrentPlan || isLoading}
                  onClick={() =>
                    !isFree &&
                    !isCurrentPlan &&
                    handleSelectPlan(plan.id as "pro" | "team")
                  }
                  className="mt-5 flex w-full items-center justify-center gap-2 rounded-full py-2.5 text-sm font-bold transition-all active:scale-[0.97] disabled:cursor-not-allowed"
                  style={
                    isFree || isCurrentPlan
                      ? {
                          background: c.card,
                          border: `1px solid ${c.border}`,
                          color: c.ink3,
                        }
                      : plan.highlight
                      ? {
                          background: "#6851FF",
                          color: "#FFFFFF",
                          boxShadow: "0 4px 14px rgba(104,81,255,0.35)",
                        }
                      : {
                          background: c.card,
                          border: `1px solid ${c.border}`,
                          color: c.ink,
                        }
                  }
                >
                  {isLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : isCurrentPlan ? (
                    <>
                      <Check className="h-3.5 w-3.5" />
                      Plano atual
                    </>
                  ) : (
                    plan.cta
                  )}
                </button>
              </div>
            );
          })}
        </div>

        {/* Error message */}
        {error && (
          <div
            className="mx-6 mb-6 rounded-xl px-4 py-3 text-sm"
            style={{
              background: "rgba(255,107,107,0.1)",
              border: "1px solid rgba(255,107,107,0.25)",
              color: "#FF6B6B",
            }}
          >
            {error}
          </div>
        )}

        {/* Footer note */}
        <p className="px-6 pb-6 text-center text-xs" style={{ color: c.ink3 }}>
          Pagamento seguro · Cancele a qualquer momento · Sem taxas ocultas
        </p>
      </div>

      <style>{`
        @keyframes planModalIn {
          from { opacity: 0; transform: scale(0.95) translateY(10px); }
          to   { opacity: 1; transform: scale(1)    translateY(0); }
        }
      `}</style>
    </div>
  );
}
