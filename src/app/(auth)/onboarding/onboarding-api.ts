import { normalizeError, parseJson } from "@/lib/api-client";
import { prewarmAbacatePayCustomer } from "@/lib/abacatepay-customer-client";
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

export async function ensureAbacatepayCustomer(): Promise<boolean> {
  return prewarmAbacatePayCustomer("onboarding");
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
  const response =
    input.provider === "stripe"
      ? await fetch("/api/stripe/checkout/verify", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ sessionId: input.sessionId }),
        })
      : await fetch("/api/abacatepay/checkout/verify", {
          method: "POST",
        });
  const body = await parseJson<VerifyPaymentResponse>(response);

  if (!response.ok) {
    throw new Error(
      normalizeError(body.error, "Não foi possível confirmar o pagamento.")
    );
  }
}
