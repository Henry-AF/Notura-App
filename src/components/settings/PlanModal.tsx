"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, Check, Sparkles, Users, X, Zap } from "lucide-react";
import {
  BillingCycleProvider,
  useBillingCycle,
} from "@/components/pricing/BillingCycleProvider";
import { PricingToggle } from "@/components/pricing/PricingToggle";
import { UpgradeButton } from "@/components/pricing/UpgradeButton";
import { prewarmBillingCustomer } from "@/lib/billing-customer-client";
import {
  CheckoutSupportRequiredError,
  startPlanCheckout,
} from "@/lib/checkout-client";
import {
  createCheckoutSelection,
  getBillingCycleLabel,
  getPlanPriceLabel,
  getPricingPlan,
  isCheckoutPlan,
  resolvePricingPlanFromInternalPlan,
  type BillingCycle,
  type CheckoutPlanType,
  type PricingPlanType,
} from "@/lib/pricing";
import { useThemeColors } from "@/lib/theme-context";

interface PlanDef {
  id: PricingPlanType;
  name: string;
  description: string;
  price: string;
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

export interface PlanModalProps {
  currentPlan: string;
  onClose: () => void;
  onSuccess?: (plan: CheckoutPlanType) => void;
}

export interface CheckoutResponseBody {
  checkoutUrl?: string;
  alreadyActive?: boolean;
}

type CheckoutSupportIssue = {
  message: string;
  whatsappUrl: string;
};

const MODAL_PLAN_IDS = ["free", "starter", "pro", "enterprise"] as const;
export const CHECKOUT_SUPPORT_MODAL_TONE = {
  background: "rgba(255,107,107,0.1)",
  border: "1px solid rgba(255,107,107,0.32)",
  actionBackground: "#FF4D4F",
};

const PLAN_STYLE: Record<
  PricingPlanType,
  Pick<PlanDef, "icon" | "iconColor" | "iconBg" | "badge" | "badgeColor" | "highlight">
> = {
  free: {
    icon: Sparkles,
    iconColor: "#9598A8",
    iconBg: "rgba(149,152,168,0.12)",
  },
  starter: {
    icon: Sparkles,
    iconColor: "#4ECB71",
    iconBg: "rgba(78,203,113,0.15)",
  },
  pro: {
    icon: Zap,
    iconColor: "#6851FF",
    iconBg: "rgba(104,81,255,0.15)",
    badge: "Mais popular",
    badgeColor: "#6851FF",
    highlight: true,
  },
  enterprise: {
    icon: Users,
    iconColor: "#06B6D4",
    iconBg: "rgba(6,182,212,0.12)",
    badge: "Atendimento consultivo",
    badgeColor: "#06B6D4",
  },
};

const PLAN_EXTRA_FEATURES: Record<PricingPlanType, string[]> = {
  free: [
    "Resumo automatico no WhatsApp",
    "Tarefas no kanban",
    "Decisoes registradas",
    "Sem precisar de cartao",
  ],
  starter: [
    "Resumo + decisoes no WhatsApp",
    "Tarefas automaticas no kanban",
    "Suporte por e-mail",
    "Cancele quando quiser",
  ],
  pro: [
    "Resumo + decisoes + kanban automatico",
    "Suporte direto no WhatsApp",
    "Chatbot de IA para consulta",
    "Portal do cliente incluido",
  ],
  enterprise: [
    "Usuarios ilimitados",
    "Onboarding assistido",
    "Integracoes personalizadas",
    "SLA e suporte prioritario",
  ],
};

function getPlanUsageFeature(planId: PricingPlanType): string {
  const plan = getPricingPlan(planId);
  return plan.monthlyLimit === null
    ? "Limite personalizado"
    : plan.usageShortLabel;
}

function buildModalPlans(billingCycle: BillingCycle): PlanDef[] {
  return MODAL_PLAN_IDS.map((planId) => {
    const plan = getPricingPlan(planId);

    return {
      id: plan.id,
      name: plan.displayName,
      description: plan.description,
      price:
        plan.id === "enterprise"
          ? "Consultar"
          : getPlanPriceLabel(plan.id, billingCycle),
      discountLabel:
        billingCycle === "yearly" && plan.id !== "free" && plan.id !== "enterprise"
          ? plan.annualSavingsLabel
          : undefined,
      period: plan.id === "enterprise" ? "" : "/mes",
      features: [getPlanUsageFeature(planId), ...PLAN_EXTRA_FEATURES[planId]],
      cta: plan.ctaLabel,
      ...PLAN_STYLE[planId],
    };
  });
}

export function createSettingsCheckoutPayload(
  plan: CheckoutPlanType,
  billingCycle: BillingCycle
) {
  return {
    ...createCheckoutSelection(plan, billingCycle),
    source: "settings" as const,
  };
}

export function isSettingsCheckoutDisabled(input: {
  currentPlan: string;
  isLoading: boolean;
  planId: PricingPlanType;
  prewarmReady: boolean;
}): boolean {
  const isFree = input.planId === "free";
  const isCurrentPlan = resolvePricingPlanFromInternalPlan(input.currentPlan) === input.planId;
  const needsCheckout = isCheckoutPlan(input.planId);

  return isFree || isCurrentPlan || input.isLoading || (needsCheckout && !input.prewarmReady);
}

export function getCheckoutSupportIssue(error: unknown): {
  message: string;
  whatsappUrl: string;
} | null {
  if (!(error instanceof CheckoutSupportRequiredError)) return null;
  return {
    message: error.message,
    whatsappUrl: error.whatsappUrl,
  };
}

export function getPlanModalMode(input: {
  supportIssue: CheckoutSupportIssue | null;
}): "plans" | "support" {
  return input.supportIssue ? "support" : "plans";
}

function PlanModalContent({ currentPlan, onClose, onSuccess }: PlanModalProps) {
  const c = useThemeColors();
  const { billingCycle, setBillingCycle } = useBillingCycle();
  const [loading, setLoading] = useState<CheckoutPlanType | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [supportIssue, setSupportIssue] = useState<CheckoutSupportIssue | null>(null);
  const [prewarmReady, setPrewarmReady] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const currentPricingPlan = resolvePricingPlanFromInternalPlan(currentPlan);
  const plans = useMemo(() => buildModalPlans(billingCycle), [billingCycle]);
  const modalMode = getPlanModalMode({ supportIssue });

  useEffect(() => {
    let cancelled = false;
    let retryTimeout: number | null = null;

    async function runPrewarm() {
      const ready = await prewarmBillingCustomer("settings").catch(() => false);
      if (cancelled) {
        return;
      }

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

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  async function handleSelectPlan(plan: PricingPlanType) {
    if (plan === currentPricingPlan) {
      onClose();
      return;
    }

    if (plan === "enterprise") {
      const contactHref = getPricingPlan("enterprise").contactHref;
      if (contactHref) {
        window.open(contactHref, "_blank", "noopener,noreferrer");
      }
      onClose();
      return;
    }

    if (!isCheckoutPlan(plan)) {
      return;
    }

    setLoading(plan);
    setError(null);
    setSupportIssue(null);

    try {
      const body = (await startPlanCheckout(
        createSettingsCheckoutPayload(plan, billingCycle)
      )) as CheckoutResponseBody;

      if (body.alreadyActive) {
        onSuccess?.(plan);
        onClose();
        return;
      }

      if (body.checkoutUrl) {
        window.location.href = body.checkoutUrl;
        return;
      }

      throw new Error("URL de checkout nao recebida.");
    } catch (err) {
      const checkoutSupportIssue = getCheckoutSupportIssue(err);
      if (checkoutSupportIssue) {
        setSupportIssue(checkoutSupportIssue);
        setLoading(null);
        return;
      }

      setError(
        err instanceof Error ? err.message : "Erro inesperado. Tente novamente."
      );
      setLoading(null);
    }
  }

  if (modalMode === "support" && supportIssue) {
    return (
      <div
        className="fixed inset-0 z-[220] flex items-end justify-center sm:items-center sm:p-4"
        style={{ background: "rgba(0,0,0,0.78)", backdropFilter: "blur(4px)" }}
        onClick={onClose}
      >
        <div
          ref={panelRef}
          className="plan-modal-panel relative w-full rounded-t-3xl sm:max-w-lg sm:rounded-2xl"
          style={{
            background: c.card,
            border: CHECKOUT_SUPPORT_MODAL_TONE.border,
            boxShadow: "0 22px 70px rgba(0,0,0,0.35)",
            maxHeight: "90dvh",
            overflowY: "auto",
          }}
          onClick={(event) => event.stopPropagation()}
          role="alertdialog"
          aria-modal="true"
          aria-label="Falha na ativação da assinatura"
        >
          <div
            className="flex items-start justify-between gap-4 border-b p-5 sm:p-6"
            style={{ borderColor: "rgba(255,107,107,0.22)" }}
          >
            <div className="flex items-start gap-3">
              <div
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl"
                style={{
                  background: CHECKOUT_SUPPORT_MODAL_TONE.background,
                  color: CHECKOUT_SUPPORT_MODAL_TONE.actionBackground,
                }}
              >
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div>
                <h2 className="font-display text-xl font-bold" style={{ color: c.ink }}>
                  Pagamento recebido, assinatura pendente
                </h2>
                <p className="mt-1 text-sm leading-relaxed" style={{ color: c.ink2 }}>
                  Precisamos regularizar sua conta manualmente.
                </p>
              </div>
            </div>
            <button
              type="button"
              aria-label="Fechar"
              onClick={onClose}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-colors"
              style={{ background: c.card2, color: c.ink3 }}
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="p-5 sm:p-6">
            <div
              className="rounded-xl px-4 py-4 text-sm"
              style={{
                background: CHECKOUT_SUPPORT_MODAL_TONE.background,
                border: CHECKOUT_SUPPORT_MODAL_TONE.border,
                color: c.ink,
              }}
            >
              <p className="font-semibold" style={{ color: CHECKOUT_SUPPORT_MODAL_TONE.actionBackground }}>
                Isso exige atenção imediata.
              </p>
              <p className="mt-2 leading-relaxed" style={{ color: c.ink2 }}>
                {supportIssue.message}
              </p>
            </div>

            <a
              className="mt-5 flex w-full items-center justify-center rounded-xl px-4 py-3 text-center text-sm font-bold text-white transition-colors"
              href={supportIssue.whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{ background: CHECKOUT_SUPPORT_MODAL_TONE.actionBackground }}
            >
              Falar com suporte imediatamente
            </a>
          </div>

          <style>{`
            @keyframes planModalSlideUp {
              from { opacity: 0; transform: translateY(100%); }
              to   { opacity: 1; transform: translateY(0); }
            }
            @keyframes planModalIn {
              from { opacity: 0; transform: scale(0.95) translateY(10px); }
              to   { opacity: 1; transform: scale(1) translateY(0); }
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
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 z-[200] flex items-end justify-center sm:items-center sm:p-4"
      style={{ background: "rgba(0,0,0,0.75)", backdropFilter: "blur(4px)" }}
      onClick={onClose}
    >
      <div
        ref={panelRef}
        className="plan-modal-panel relative w-full rounded-t-3xl sm:max-w-6xl sm:rounded-2xl"
        style={{
          background: c.card,
          border: `1px solid ${c.border}`,
          maxHeight: "calc(100dvh - 32px)",
          overflow: "hidden",
        }}
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Escolher plano"
      >
        <div
          className="mx-auto mb-1 mt-3 h-1 w-10 shrink-0 rounded-full sm:hidden"
          style={{ background: c.border }}
        />

        <div
          className="flex items-center justify-between px-4 py-3 sm:px-5 sm:py-4"
          style={{
            background: c.card,
            borderBottom: `1px solid ${c.border}`,
          }}
        >
          <div>
            <h2 className="font-display text-lg font-bold sm:text-xl" style={{ color: c.ink }}>
              Escolha seu plano
            </h2>
            <p className="mt-0.5 text-xs sm:text-sm" style={{ color: c.ink2 }}>
              Atualize a qualquer momento. Cancele quando quiser.
            </p>
          </div>
          <button
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-full transition-colors"
            style={{ background: c.card2, color: c.ink3 }}
            onMouseEnter={(event) => {
              event.currentTarget.style.background = c.border;
            }}
            onMouseLeave={(event) => {
              event.currentTarget.style.background = c.card2;
            }}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="px-4 pt-3 text-center sm:px-5">
          <PricingToggle billingCycle={billingCycle} onChange={setBillingCycle} />
          <p className="mt-2 text-xs" style={{ color: c.ink3 }}>
            {getBillingCycleLabel(billingCycle)}. A selecao e mantida entre paginas e checkouts.
          </p>
        </div>

        <div className="flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-smooth px-4 pb-4 pt-4 sm:grid sm:grid-cols-4 sm:overflow-x-visible sm:snap-none sm:px-5 sm:pb-4 sm:pt-4">
          {plans.map((plan) => {
            const isCurrentPlan = currentPricingPlan === plan.id;
            const isLoading = loading === plan.id;
            const isFree = plan.id === "free";
            const isEnterprise = plan.id === "enterprise";
            const isPreparingCustomer =
              !prewarmReady && isCheckoutPlan(plan.id) && !isCurrentPlan;
            const isDisabled = isSettingsCheckoutDisabled({
              currentPlan,
              isLoading,
              planId: plan.id,
              prewarmReady,
            });

            return (
              <div
                key={plan.id}
                className="relative flex w-[82vw] shrink-0 snap-center flex-col rounded-2xl p-4 sm:w-auto"
                style={{
                  background: plan.highlight ? "rgba(104,81,255,0.07)" : c.card2,
                  border: plan.highlight
                    ? "2px solid rgba(104,81,255,0.4)"
                    : `1px solid ${c.border}`,
                  transition: "transform 0.15s ease, box-shadow 0.15s ease",
                }}
                onMouseEnter={(event) => {
                  if (!isFree) {
                    event.currentTarget.style.transform = "translateY(-2px)";
                  }
                }}
                onMouseLeave={(event) => {
                  event.currentTarget.style.transform = "translateY(0)";
                }}
              >
                {plan.badge ? (
                  <div
                    className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full px-3 py-0.5 text-[11px] font-bold text-white"
                    style={{ background: plan.badgeColor }}
                  >
                    {plan.badge}
                  </div>
                ) : null}

                <div
                  className="flex h-9 w-9 items-center justify-center rounded-xl"
                  style={{ background: plan.iconBg }}
                >
                  <plan.icon className="h-4 w-4" style={{ color: plan.iconColor }} />
                </div>

                <div className="mt-3">
                  <p className="text-sm font-semibold" style={{ color: c.ink2 }}>
                    {plan.name}
                  </p>
                  <p className="mt-1 min-h-[34px] text-xs leading-snug" style={{ color: c.ink3 }}>
                    {plan.description}
                  </p>

                  {plan.discountLabel ? (
                    <div className="mt-1.5 flex items-center gap-2">
                      <span
                        className="rounded-full px-2 py-0.5 text-[11px] font-bold"
                        style={{
                          background: plan.highlight
                            ? "rgba(104,81,255,0.15)"
                            : "rgba(6,182,212,0.12)",
                          color: plan.highlight ? "#6851FF" : "#06B6D4",
                        }}
                      >
                        {plan.discountLabel}
                      </span>
                    </div>
                  ) : null}

                  <div className="mt-1 flex items-end gap-1">
                    <span className="font-display text-2xl font-bold sm:text-[28px]" style={{ color: c.ink }}>
                      {plan.price}
                    </span>
                    <span className="mb-1 text-sm" style={{ color: c.ink3 }}>
                      {plan.period}
                    </span>
                  </div>
                </div>

                <ul className="mt-3 flex-1 space-y-1.5">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2">
                      <Check
                        className="mt-0.5 h-3.5 w-3.5 shrink-0"
                        style={{
                          color: plan.highlight
                            ? "#6851FF"
                            : plan.id === "enterprise"
                              ? "#06B6D4"
                              : "#4ECB71",
                        }}
                      />
                      <span className="text-xs leading-snug" style={{ color: c.ink2 }}>
                        {feature}
                      </span>
                    </li>
                  ))}
                </ul>

                <UpgradeButton
                  disabled={isDisabled}
                  loading={isLoading || isPreparingCustomer}
                  onClick={() => {
                    if (!isFree && !isCurrentPlan && (isEnterprise || prewarmReady)) {
                      void handleSelectPlan(plan.id);
                    }
                  }}
                  className="mt-4"
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
                        : isEnterprise
                          ? {
                              background: c.card,
                              border: "1px solid rgba(6,182,212,0.35)",
                              color: "#0891B2",
                            }
                          : {
                              background: c.card,
                              border: `1px solid ${c.border}`,
                              color: c.ink,
                            }
                  }
                  label={
                    isPreparingCustomer
                      ? "Preparando..."
                      : isCurrentPlan
                        ? "Plano atual"
                        : plan.cta
                  }
                />
              </div>
            );
          })}
        </div>

        {error ? (
          <div
            className="mx-4 mb-3 rounded-xl px-4 py-2 text-sm sm:mx-5"
            style={{
              background: "rgba(255,107,107,0.1)",
              border: "1px solid rgba(255,107,107,0.25)",
              color: "#FF6B6B",
            }}
          >
            {error}
          </div>
        ) : null}

        <p className="px-4 pb-4 pt-0 text-center text-xs sm:px-5" style={{ color: c.ink3 }}>
          Pagamento seguro · {getBillingCycleLabel(billingCycle)} · Cancele a qualquer momento
        </p>
      </div>

      <style>{`
        @keyframes planModalSlideUp {
          from { opacity: 0; transform: translateY(100%); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes planModalIn {
          from { opacity: 0; transform: scale(0.95) translateY(10px); }
          to   { opacity: 1; transform: scale(1) translateY(0); }
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

export function PlanModal(props: PlanModalProps) {
  return (
    <BillingCycleProvider>
      <PlanModalContent {...props} />
    </BillingCycleProvider>
  );
}
