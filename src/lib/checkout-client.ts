import { normalizeError, parseJson } from "@/lib/api-client";
import type { BillingCycle, CheckoutPlanType } from "@/lib/pricing";

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

function shouldFallbackToStripe(status: number, message: string | undefined): boolean {
  if (status !== 400 && status !== 500) {
    return false;
  }

  const normalized = (message ?? "").toLowerCase();
  return (
    normalized.includes("abacatepay") ||
    normalized.includes("missing") ||
    normalized.includes("product id") ||
    normalized.includes("nao configurado")
  );
}

export async function startPlanCheckout(
  request: StartCheckoutRequest
): Promise<CheckoutStartResult> {
  let response = await fetch("/api/abacatepay/checkout", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(request),
  });
  let body = await parseJson<StartCheckoutResponse>(response);

  if (!response.ok && shouldFallbackToStripe(response.status, body.error)) {
    response = await fetch("/api/stripe/checkout", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(request),
    });
    body = await parseJson<StartCheckoutResponse>(response);
  }

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