import { isCheckoutPlan, type PricingPlanType } from "@/lib/pricing";

export function isOnboardingCheckoutBlocked(input: {
  loading: boolean;
  paymentVerifying: boolean;
  prewarmReady: boolean;
  selectedPlan: PricingPlanType;
}): boolean {
  return (
    input.loading ||
    input.paymentVerifying ||
    (isCheckoutPlan(input.selectedPlan) && !input.prewarmReady)
  );
}
