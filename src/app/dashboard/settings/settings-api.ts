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

type CheckoutProvider = "abacatepay" | "stripe";

interface VerifySettingsPaymentInput {
  provider: CheckoutProvider;
  sessionId?: string | null;
}

export function prewarmAbacatePayCustomer(): Promise<boolean> {
  return prewarmAbacatePayCustomerRequest("settings");
}

export function prewarmAbacatePayCustomerInBackground(): void {
  prewarmAbacatePayCustomerRequestInBackground("settings");
}

export async function verifySettingsPayment(
  input: VerifySettingsPaymentInput
): Promise<void> {
  const response =
    input.provider === "stripe"
      ? await fetch("/api/stripe/checkout/verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId: input.sessionId }),
        })
      : await fetch("/api/abacatepay/checkout/verify", {
          method: "POST",
        });
  const body = await parseJson<VerifySettingsPaymentResponse>(response);

  if (!response.ok) {
    throw new Error(
      normalizeError(body.error, "Não foi possível confirmar o pagamento.")
    );
  }
}
