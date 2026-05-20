import type { Plan } from "@/types/database";
import { buildSupportWhatsAppUrl } from "@/lib/support-contact";

export const BILLING_CYCLES = ["monthly", "yearly"] as const;
export const PRICING_PLANS = ["free", "starter", "pro", "enterprise"] as const;
export const CHECKOUT_PLANS = ["starter", "pro"] as const;

export type BillingCycle = (typeof BILLING_CYCLES)[number];
export type PricingPlanType = (typeof PRICING_PLANS)[number];
export type CheckoutPlanType = (typeof CHECKOUT_PLANS)[number];
export type InternalPaidPlan = Exclude<Plan, "free">;

export interface PricingTier {
  price: number;
  priceInCents: number;
}

export interface PricingPlanDefinition {
  id: PricingPlanType;
  displayName: string;
  title: string;
  description: string;
  usageShortLabel: string;
  monthlyLimit: number | null;
  billingOptions?: Partial<Record<BillingCycle, PricingTier>>;
  internalPlan: Plan | null;
  ctaLabel: string;
  contactHref?: string;
  badgeLabel?: string;
  annualSavingsLabel?: string;
}

export type PricingConfig = Record<PricingPlanType, PricingPlanDefinition>;

const BRL_INTEGER_FORMATTER = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

export const DEFAULT_BILLING_CYCLE: BillingCycle = "monthly";
export const ANNUAL_SAVINGS_LABEL = "economize 30%";

export const PRICING: PricingConfig = {
  free: {
    id: "free",
    displayName: "Free",
    title: "Plano Free",
    description: "Teste agora. Sem cartão. Sem compromisso.",
    usageShortLabel: "3 reuniões grátis",
    monthlyLimit: 3,
    internalPlan: "free",
    ctaLabel: "Testar agora — é grátis",
  },
  starter: {
    id: "starter",
    displayName: "Starter",
    title: "Plano Starter",
    description: "Para quem já viu o valor e quer escalar.",
    usageShortLabel: "30 reuniões por mês",
    monthlyLimit: 30,
    internalPlan: "pro",
    ctaLabel: "Começar agora",
    annualSavingsLabel: ANNUAL_SAVINGS_LABEL,
    billingOptions: {
      monthly: {
        price: 49,
        priceInCents: 4900,
      },
      yearly: {
        price: 39,
        priceInCents: 3900,
      },
    },
  },
  pro: {
    id: "pro",
    displayName: "Pro",
    title: "Plano Pro",
    description: "Até 100 reuniões por mês com execução máxima.",
    usageShortLabel: "100 reuniões por mês",
    monthlyLimit: 100,
    internalPlan: "team",
    ctaLabel: "Quero o Pro — começar agora",
    badgeLabel: "Mais popular",
    annualSavingsLabel: ANNUAL_SAVINGS_LABEL,
    billingOptions: {
      monthly: {
        price: 99,
        priceInCents: 9900,
      },
      yearly: {
        price: 69,
        priceInCents: 6900,
      },
    },
  },
  enterprise: {
    id: "enterprise",
    displayName: "Enterprise",
    title: "Plano Enterprise",
    description: "Operação grande, necessidades específicas.",
    usageShortLabel: "Escopo personalizado",
    monthlyLimit: null,
    internalPlan: null,
    ctaLabel: "Falar com a equipe",
    contactHref: buildSupportWhatsAppUrl(),
    annualSavingsLabel: ANNUAL_SAVINGS_LABEL,
  },
};

export function isBillingCycle(value: string | null | undefined): value is BillingCycle {
  return value === "monthly" || value === "yearly";
}

export function isPricingPlan(value: string | null | undefined): value is PricingPlanType {
  return value === "free" || value === "starter" || value === "pro" || value === "enterprise";
}

export function isCheckoutPlan(value: string | null | undefined): value is CheckoutPlanType {
  return value === "starter" || value === "pro";
}

export function resolveBillingCycle(value: string | null | undefined): BillingCycle {
  return isBillingCycle(value) ? value : DEFAULT_BILLING_CYCLE;
}

export function getBillingCycleLabel(billingCycle: BillingCycle): string {
  return billingCycle === "yearly" ? "Cobrado anualmente" : "Cobrado mensalmente";
}

export function getBillingCycleDisplayName(billingCycle: BillingCycle): string {
  return billingCycle === "yearly" ? "Anual" : "Mensal";
}

export function getPricingPlan(plan: PricingPlanType): PricingPlanDefinition {
  return PRICING[plan];
}

export function resolveInternalPlanForCheckout(plan: CheckoutPlanType): InternalPaidPlan {
  return plan === "starter" ? "pro" : "team";
}

export function resolvePricingPlanFromInternalPlan(
  plan: string | null | undefined
): PricingPlanType | null {
  if (!plan) {
    return null;
  }

  if (plan === "free") {
    return "free";
  }

  if (plan === "pro") {
    return "starter";
  }

  if (plan === "team") {
    return "pro";
  }

  if (plan === "enterprise") {
    return "enterprise";
  }

  return null;
}

export function getPlanPrice(plan: PricingPlanType, billingCycle: BillingCycle): number {
  const tier = PRICING[plan].billingOptions?.[billingCycle];
  return tier?.price ?? 0;
}

export function getPlanPriceInCents(plan: PricingPlanType, billingCycle: BillingCycle): number {
  const tier = PRICING[plan].billingOptions?.[billingCycle];
  return tier?.priceInCents ?? 0;
}

export function getPlanPriceLabel(plan: PricingPlanType, billingCycle: BillingCycle): string {
  return BRL_INTEGER_FORMATTER.format(getPlanPrice(plan, billingCycle)).replace(/\u00A0/g, " ");
}

export function getPlanSummary(plan: CheckoutPlanType, billingCycle: BillingCycle): string {
  const pricingPlan = getPricingPlan(plan);
  return `Você está assinando o plano ${pricingPlan.displayName} ${getBillingCycleDisplayName(billingCycle)} por ${getPlanPriceLabel(plan, billingCycle)}/mês.`;
}

export interface CheckoutSelection {
  plan: CheckoutPlanType;
  billingCycle: BillingCycle;
  price: number;
}

export function createCheckoutSelection(
  plan: CheckoutPlanType,
  billingCycle: BillingCycle
): CheckoutSelection {
  return {
    plan,
    billingCycle,
    price: getPlanPrice(plan, billingCycle),
  };
}
