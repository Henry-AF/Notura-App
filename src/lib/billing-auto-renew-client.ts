import { normalizeError, parseJson } from "@/lib/api-client";
import type { BillingGatewayProvider } from "@/lib/billing-gateway";

export interface BillingAutoRenewStatus {
  provider: BillingGatewayProvider;
  autoRenewEnabled: boolean;
  currentPeriodEnd: string | null;
  renewalStatus: string;
}

interface BillingAutoRenewResponse extends Partial<BillingAutoRenewStatus> {
  error?: string;
}

export async function updateBillingAutoRenew(
  enabled: boolean
): Promise<BillingAutoRenewStatus> {
  const response = await fetch("/api/billing/auto-renew", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ enabled }),
  });
  const body = await parseJson<BillingAutoRenewResponse>(response);

  if (
    !response.ok ||
    (body.provider !== "stripe" && body.provider !== "abacatepay") ||
    typeof body.autoRenewEnabled !== "boolean" ||
    typeof body.renewalStatus !== "string"
  ) {
    throw new Error(
      normalizeError(
        body.error,
        "Não foi possível atualizar a renovação automática."
      )
    );
  }

  return {
    provider: body.provider,
    autoRenewEnabled: body.autoRenewEnabled,
    currentPeriodEnd: body.currentPeriodEnd ?? null,
    renewalStatus: body.renewalStatus,
  };
}
