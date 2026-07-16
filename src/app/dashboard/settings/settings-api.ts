import { normalizeError, parseJson } from "@/lib/api-client";
import {
  prewarmBillingCustomer as prewarmBillingCustomerRequest,
  prewarmBillingCustomerInBackground as prewarmBillingCustomerRequestInBackground,
} from "@/lib/billing-customer-client";
export {
  updateBillingAutoRenew,
} from "@/lib/billing-auto-renew-client";
export type {
  BillingAutoRenewStatus,
} from "@/lib/billing-auto-renew-client";

export {
  fetchCurrentUser,
  updateCurrentUser,
} from "@/lib/user/current-user-client";
export type {
  CurrentUser,
  UpdateCurrentUserInput,
} from "@/lib/user/current-user-types";

export {
  registerIntegrationInterest,
  fetchIntegrationInterest,
} from "@/lib/integrations/integration-interest-client";
export type { IntegrationChannel } from "@/lib/integrations/integration-interest";

interface VerifySettingsPaymentResponse {
  error?: string;
}

export function prewarmBillingCustomer(): Promise<boolean> {
  return prewarmBillingCustomerRequest("settings");
}

export function prewarmBillingCustomerInBackground(): void {
  prewarmBillingCustomerRequestInBackground("settings");
}

export async function verifySettingsPayment(
  sessionId?: string | null
): Promise<void> {
  const payload = sessionId ? { sessionId } : {};
  const response = await fetch("/api/billing/checkout/verify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const body = await parseJson<VerifySettingsPaymentResponse>(response);

  if (!response.ok) {
    throw new Error(
      normalizeError(body.error, "Não foi possível confirmar o pagamento.")
    );
  }
}
