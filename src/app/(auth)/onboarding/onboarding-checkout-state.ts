import type { Plan } from "@/types/database";

export function isOnboardingCheckoutBlocked(input: {
  loading: boolean;
  paymentVerifying: boolean;
  prewarmReady: boolean;
  selectedPlan: Plan;
}): boolean {
  return (
    input.loading ||
    input.paymentVerifying ||
    (input.selectedPlan !== "free" && !input.prewarmReady)
  );
}
