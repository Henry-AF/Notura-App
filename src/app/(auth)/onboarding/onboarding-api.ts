import { normalizeError, parseJson } from "@/lib/api-client";
import { prewarmBillingCustomer } from "@/lib/billing-customer-client";
import {
  startPlanCheckout,
  type CheckoutStartResult,
  type StartCheckoutRequest,
} from "@/lib/checkout-client";
import {
  createCheckoutSelection,
  DEFAULT_BILLING_CYCLE,
  isCheckoutPlan,
  type CheckoutPlanType,
} from "@/lib/pricing";

interface VerifyPaymentResponse {
  error?: string;
}

type CheckoutProvider = "abacatepay" | "stripe";

interface VerifyPaymentInput {
  provider: CheckoutProvider;
  sessionId?: string | null;
}

export type OnboardingCheckoutResult = CheckoutStartResult;

export async function ensureOnboardingBillingCustomer(): Promise<boolean> {
  return prewarmBillingCustomer("onboarding");
}

export async function startOnboardingCheckout(
  input: Omit<StartCheckoutRequest, "source"> | CheckoutPlanType
): Promise<OnboardingCheckoutResult> {
  const request =
    typeof input === "string"
      ? createCheckoutSelection(
          isCheckoutPlan(input) ? input : "starter",
          DEFAULT_BILLING_CYCLE
        )
      : input;

  return startPlanCheckout({
    ...request,
    source: "onboarding",
  });
}

export async function verifyOnboardingPayment(
  input: VerifyPaymentInput
): Promise<void> {
  const payload = input.sessionId ? { sessionId: input.sessionId } : {};
  const response = await fetch("/api/billing/checkout/verify", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  const body = await parseJson<VerifyPaymentResponse>(response);

  if (!response.ok) {
    throw new Error(
      normalizeError(body.error, "Não foi possível confirmar o pagamento.")
    );
  }
}
