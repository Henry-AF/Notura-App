import { normalizeError, parseJson } from "@/lib/api-client";

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
