import { normalizeError, parseJson } from "@/lib/api-client";
import {
  prewarmAbacatePayCustomer as prewarmAbacatePayCustomerRequest,
  prewarmAbacatePayCustomerInBackground as prewarmAbacatePayCustomerRequestInBackground,
} from "@/lib/abacatepay-customer-client";
export {
  updateAbacatePayAutoRenew,
} from "@/lib/abacatepay-auto-renew-client";
export type {
  AbacatePayAutoRenewStatus,
} from "@/lib/abacatepay-auto-renew-client";

export {
  fetchCurrentUser,
  updateCurrentUser,
} from "@/lib/user/current-user-client";
export type {
  CurrentUser,
  UpdateCurrentUserInput,
} from "@/lib/user/current-user-types";

interface VerifySettingsPaymentResponse {
  error?: string;
}

export function prewarmAbacatePayCustomer(): Promise<boolean> {
  return prewarmAbacatePayCustomerRequest("settings");
}

export function prewarmAbacatePayCustomerInBackground(): void {
  prewarmAbacatePayCustomerRequestInBackground("settings");
}

export async function verifySettingsPayment(): Promise<void> {
  const response = await fetch("/api/abacatepay/checkout/verify", {
    method: "POST",
  });
  const body = await parseJson<VerifySettingsPaymentResponse>(response);

  if (!response.ok) {
    throw new Error(
      normalizeError(body.error, "Não foi possível confirmar o pagamento.")
    );
  }
}
