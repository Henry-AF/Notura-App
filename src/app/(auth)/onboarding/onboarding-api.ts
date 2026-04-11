import { normalizeError, parseJson } from "@/lib/api-client";
import type { Plan } from "@/types/database";

interface StartCheckoutResponse {
  checkoutUrl?: string;
  alreadyActive?: boolean;
  error?: string;
}

interface VerifyPaymentResponse {
  error?: string;
}

export interface OnboardingCheckoutResult {
  checkoutUrl: string | null;
  alreadyActive: boolean;
}

export async function ensureAbacatepayCustomer(): Promise<boolean> {
  const response = await fetch("/api/abacatepay/customer/ensure", {
    method: "POST",
  });

  return response.ok || response.status === 202;
}

export async function startOnboardingCheckout(
  plan: Plan
): Promise<OnboardingCheckoutResult> {
  const response = await fetch("/api/abacatepay/checkout", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ plan }),
  });
  const body = await parseJson<StartCheckoutResponse>(response);

  if (!response.ok) {
    throw new Error(normalizeError(body.error, "Falha ao iniciar o checkout."));
  }

  if (body.alreadyActive) {
    return { checkoutUrl: null, alreadyActive: true };
  }

  if (!body.checkoutUrl) {
    throw new Error("Checkout não retornou URL de redirecionamento.");
  }

  return {
    checkoutUrl: body.checkoutUrl,
    alreadyActive: false,
  };
}

export async function verifyOnboardingPayment(): Promise<void> {
  const response = await fetch("/api/abacatepay/checkout/verify", {
    method: "POST",
  });
  const body = await parseJson<VerifyPaymentResponse>(response);

  if (!response.ok) {
    throw new Error(
      normalizeError(body.error, "Não foi possível confirmar o pagamento.")
    );
  }
}
