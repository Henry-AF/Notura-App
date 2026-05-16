import type { Plan } from "@/types/database";
import {
  DEFAULT_BILLING_CYCLE,
  getPlanPriceInCents,
  getPricingPlan,
  type PricingPlanType,
} from "@/lib/pricing";

export const APP_PLAN_IDS = ["free", "pro", "team"] as const;
export const APP_PAID_PLAN_IDS = ["pro", "team"] as const;

export type AppPlanId = (typeof APP_PLAN_IDS)[number];
export type PaidPlan = (typeof APP_PAID_PLAN_IDS)[number];

export interface PlanCatalogEntry {
  id: AppPlanId;
  displayName: string;
  title: string;
  priceInCents: number;
  monthlyLimit: number | null;
  usageShortLabel: string;
}

const INTERNAL_TO_PRICING_PLAN: Record<AppPlanId, PricingPlanType> = {
  free: "free",
  pro: "starter",
  team: "pro",
};

const PLAN_CATALOG: Record<AppPlanId, PlanCatalogEntry> = APP_PLAN_IDS.reduce(
  (catalog, planId) => {
    const pricingPlan = getPricingPlan(INTERNAL_TO_PRICING_PLAN[planId]);

    catalog[planId] = {
      id: planId,
      displayName: pricingPlan.displayName,
      title: pricingPlan.title,
      priceInCents: getPlanPriceInCents(pricingPlan.id, DEFAULT_BILLING_CYCLE),
      monthlyLimit: pricingPlan.monthlyLimit,
      usageShortLabel: pricingPlan.usageShortLabel,
    };

    return catalog;
  },
  {} as Record<AppPlanId, PlanCatalogEntry>
);

const BRL_PRICE_FORMATTER = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

function formatPriceFromCents(priceInCents: number): string {
  return BRL_PRICE_FORMATTER.format(priceInCents / 100);
}

export function isPlan(value: string | null | undefined): value is Plan {
  return value === "free" || value === "pro" || value === "team";
}

export function isPaidPlan(plan: Plan): plan is PaidPlan {
  return plan === "pro" || plan === "team";
}

export function getPlanCatalogEntry(plan: Plan): PlanCatalogEntry {
  return PLAN_CATALOG[plan];
}

export function getPlanDisplayName(plan: Plan): string {
  return getPlanCatalogEntry(plan).displayName;
}

export function getPlanTitle(plan: Plan): string {
  return getPlanCatalogEntry(plan).title;
}

export function getPlanPriceLabel(plan: Plan): string {
  return formatPriceFromCents(getPlanCatalogEntry(plan).priceInCents).replace(
    /\u00A0/g,
    " "
  );
}

export function getPlanMonthlyLimit(plan: Plan): number | null {
  return getPlanCatalogEntry(plan).monthlyLimit;
}

export function getPlanUsageShortLabel(plan: Plan): string {
  return getPlanCatalogEntry(plan).usageShortLabel;
}
