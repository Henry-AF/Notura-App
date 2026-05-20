import { normalizeError, parseJson } from "@/lib/api-client";
import {
  resolveInternalPlanForCheckout,
  type BillingCycle,
  type CheckoutPlanType,
} from "@/lib/pricing";

export interface StartCheckoutRequest {
  plan: CheckoutPlanType;
  billingCycle: BillingCycle;
  price: number;
  source: "onboarding" | "settings";
}

interface StartCheckoutResponse {
  checkoutUrl?: string;
  alreadyActive?: boolean;
  error?: string;
}

export interface CheckoutStartResult {
  checkoutUrl: string | null;
  alreadyActive: boolean;
}

export async function startPlanCheckout(
  request: StartCheckoutRequest
): Promise<CheckoutStartResult> {
  const response = await fetch("/api/billing/checkout", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      ...request,
      plan: resolveInternalPlanForCheckout(request.plan),
    }),
  });
  const body = await parseJson<StartCheckoutResponse>(response);

  if (!response.ok) {
    throw new Error(normalizeError(body.error, "Falha ao iniciar o checkout."));
  }

  if (body.alreadyActive) {
    return {
      checkoutUrl: null,
      alreadyActive: true,
    };
  }

  if (!body.checkoutUrl) {
    throw new Error("Checkout não retornou URL de redirecionamento.");
  }

  return {
    checkoutUrl: body.checkoutUrl,
    alreadyActive: false,
  };
}
