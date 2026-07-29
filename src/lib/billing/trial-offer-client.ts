import { normalizeError, parseJson } from "@/lib/api-client";

interface StartTrialCheckoutResponse {
  checkoutUrl?: string;
  alreadyActive?: boolean;
  error?: string;
}

interface DismissTrialOfferResponse {
  dismissed?: boolean;
  error?: string;
}

interface VerifyTrialCheckoutResponse {
  success?: boolean;
  error?: string;
}

export async function startTrialCheckout(): Promise<void> {
  const response = await fetch("/api/billing/trial/checkout", {
    method: "POST",
  });
  const body = await parseJson<StartTrialCheckoutResponse>(response);

  if (!response.ok) {
    throw new Error(
      normalizeError(body.error, "Falha ao iniciar o período de teste.")
    );
  }

  if (!body.checkoutUrl) {
    throw new Error("Checkout do trial não retornou URL de redirecionamento.");
  }

  window.location.href = body.checkoutUrl;
}

export async function dismissTrialOffer(): Promise<void> {
  const response = await fetch("/api/billing/trial/dismiss", {
    method: "PATCH",
  });
  const body = await parseJson<DismissTrialOfferResponse>(response);

  if (!response.ok) {
    throw new Error(
      normalizeError(body.error, "Falha ao dispensar a oferta de teste.")
    );
  }
}

export async function verifyTrialCheckout(sessionId: string): Promise<void> {
  const response = await fetch("/api/billing/trial/verify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sessionId }),
  });
  const body = await parseJson<VerifyTrialCheckoutResponse>(response);

  if (!response.ok) {
    throw new Error(
      normalizeError(body.error, "Não foi possível confirmar o período de teste.")
    );
  }
}
