import { normalizeError, parseJson } from "@/lib/api-client";

export interface AbacatePayAutoRenewStatus {
  autoRenewEnabled: boolean;
  currentPeriodEnd: string | null;
  renewalStatus: string;
}

interface AbacatePayAutoRenewResponse
  extends Partial<AbacatePayAutoRenewStatus> {
  error?: string;
}

export async function updateAbacatePayAutoRenew(
  enabled: boolean
): Promise<AbacatePayAutoRenewStatus> {
  const response = await fetch("/api/abacatepay/auto-renew", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ enabled }),
  });
  const body = await parseJson<AbacatePayAutoRenewResponse>(response);

  if (
    !response.ok ||
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
    autoRenewEnabled: body.autoRenewEnabled,
    currentPeriodEnd: body.currentPeriodEnd ?? null,
    renewalStatus: body.renewalStatus,
  };
}
