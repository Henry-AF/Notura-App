"use client";

import React, { useEffect, useRef, useState } from "react";
import { Check, X, Zap, Users, Sparkles, Loader2 } from "lucide-react";
import {
  APP_PLAN_IDS,
  getPlanDisplayName,
  getPlanMonthlyLimit,
  getPlanPriceLabel,
} from "@/lib/plans";
import { prewarmBillingCustomer } from "@/lib/billing-customer-client";
import { useThemeColors } from "@/lib/theme-context";
import type { Plan } from "@/types/database";

// ─── Plan definitions ─────────────────────────────────────────────────────────

interface PlanDef {
  id: Plan;
  name: string;
  price: string;
  originalPrice?: string;
  discountLabel?: string;
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

const PLAN_ORIGINAL_PRICES: Partial<Record<Plan, { price: string; discount: string }>> = {
  pro:  { price: "R$ 89,90", discount: "-33%" },
  team: { price: "R$ 119,90", discount: "-33%" },
};

const PLANS: PlanDef[] = APP_PLAN_IDS.map((planId) => ({
  id: planId,
  name: getPlanDisplayName(planId),
  price: getPlanPriceLabel(planId),
  originalPrice: PLAN_ORIGINAL_PRICES[planId]?.price,
  discountLabel: PLAN_ORIGINAL_PRICES[planId]?.discount,
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

export function createSettingsCheckoutPayload(plan: "pro" | "team") {
  return {
    plan,
    source: "settings" as const,
  };
}

export function createSettingsCheckoutRequest(plan: "pro" | "team") {
  return {
    url: "/api/billing/checkout",
    init: {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(createSettingsCheckoutPayload(plan)),
    },
  };
}

export function isSettingsCheckoutDisabled(input: {
  currentPlan: string;
  isLoading: boolean;
  planId: Plan;
  prewarmReady: boolean;
}): boolean {
  const isFree = input.planId === "free";
  const isCurrentPlan =
    input.currentPlan === input.planId ||
    (input.currentPlan.toLowerCase().includes(input.planId) && !isFree);

  return isFree || isCurrentPlan || input.isLoading || !input.prewarmReady;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function PlanModal({ currentPlan, onClose, onSuccess }: PlanModalProps) {
  const c = useThemeColors();
  const [loading, setLoading] = useState<"pro" | "team" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [prewarmReady, setPrewarmReady] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    let retryTimeout: number | null = null;

    async function runPrewarm() {
      const ready = await prewarmBillingCustomer("settings").catch(() => false);
      if (cancelled) return;

      setPrewarmReady(ready);
      if (!ready) {
        retryTimeout = window.setTimeout(runPrewarm, 1500);
      }
    }

    void runPrewarm();

    return () => {
      cancelled = true;
      if (retryTimeout !== null) {
        window.clearTimeout(retryTimeout);
      }
    };
  }, []);

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
      const request = createSettingsCheckoutRequest(plan);
      const res = await fetch(request.url, request.init);

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
      className="fixed inset-0 z-[200] flex items-end justify-center sm:items-center sm:p-4"
      style={{ background: "rgba(0,0,0,0.75)", backdropFilter: "blur(4px)" }}
      onClick={onClose}
    >
      <div
        ref={panelRef}
        className="plan-modal-panel relative w-full rounded-t-3xl sm:max-w-3xl sm:rounded-2xl"
        style={{
          background: c.card,
          border: `1px solid ${c.border}`,
          maxHeight: "90dvh",
          overflowY: "auto",
        }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Escolher plano"
      >
        {/* Mobile drag handle */}
        <div
          className="mx-auto mb-1 mt-3 h-1 w-10 shrink-0 rounded-full sm:hidden"
          style={{ background: c.border }}
        />
        {/* Header */}
        <div
          className="sticky top-0 z-10 flex items-center justify-between p-4 sm:p-6"
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
        <div className="flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-smooth px-4 pb-6 pt-4 sm:grid sm:grid-cols-3 sm:overflow-x-visible sm:snap-none sm:px-6 sm:pb-6 sm:pt-6">
          {PLANS.map((plan) => {
            const isCurrentPlan =
              currentPlan === plan.id ||
              (currentPlan.toLowerCase().includes(plan.id) && plan.id !== "free");
            const isLoading = loading === plan.id;
            const isFree = plan.id === "free";
            const isPreparingCustomer =
              !prewarmReady && !isFree && !isCurrentPlan;
            const isDisabled = isSettingsCheckoutDisabled({
              currentPlan,
              isLoading,
              planId: plan.id,
              prewarmReady,
            });

            return (
              <div
                key={plan.id}
                className="relative flex w-[82vw] shrink-0 snap-center flex-col rounded-2xl p-5 sm:w-auto"
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

                  {/* Original (strikethrough) price + discount badge */}
                  {plan.originalPrice && (
                    <div className="mt-1.5 flex items-center gap-2">
                      <span
                        className="text-sm line-through"
                        style={{ color: c.ink3 }}
                      >
                        {plan.originalPrice}
                      </span>
                      {plan.discountLabel && (
                        <span
                          className="rounded-full px-2 py-0.5 text-[11px] font-bold"
                          style={{
                            background: plan.highlight
                              ? "rgba(104,81,255,0.15)"
                              : "rgba(233,30,140,0.12)",
                            color: plan.highlight ? "#6851FF" : "#E91E8C",
                          }}
                        >
                          {plan.discountLabel}
                        </span>
                      )}
                    </div>
                  )}

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
                  disabled={isDisabled}
                  onClick={() =>
                    !isFree &&
                    !isCurrentPlan &&
                    prewarmReady &&
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
                  {isPreparingCustomer ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Preparando...
                    </>
                  ) : isLoading ? (
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
            className="mx-4 mb-4 rounded-xl px-4 py-3 text-sm sm:mx-6 sm:mb-6"
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
        <p className="px-4 pb-4 pt-1 text-center text-xs sm:px-6 sm:pb-6" style={{ color: c.ink3 }}>
          Pagamento seguro · Cancele a qualquer momento · Sem taxas ocultas
        </p>
      </div>

      <style>{`
        @keyframes planModalSlideUp {
          from { opacity: 0; transform: translateY(100%); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes planModalIn {
          from { opacity: 0; transform: scale(0.95) translateY(10px); }
          to   { opacity: 1; transform: scale(1)    translateY(0); }
        }
        .plan-modal-panel {
          animation: planModalSlideUp 0.3s cubic-bezier(0.3, 0, 0.1, 1);
        }
        @media (min-width: 640px) {
          .plan-modal-panel {
            animation: planModalIn 0.2s cubic-bezier(0.25, 0.46, 0.45, 0.94);
          }
        }
      `}</style>
    </div>
  );
}
