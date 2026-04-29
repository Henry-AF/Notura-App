interface AbacatePayCustomerPrewarmResponse {
  success?: boolean;
  customerId?: string;
}

export type AbacatePayCustomerPrewarmSource =
  | "onboarding"
  | "settings"
  | "unknown";

export async function prewarmAbacatePayCustomer(
  source: AbacatePayCustomerPrewarmSource = "unknown"
): Promise<boolean> {
  const response = await fetch("/api/abacatepay/customer/ensure", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ source }),
  });

  if (!response.ok || response.status === 202) {
    return false;
  }

  let body: AbacatePayCustomerPrewarmResponse = {};
  try {
    body = (await response.json()) as AbacatePayCustomerPrewarmResponse;
  } catch {
    return false;
  }

  return body.success === true && typeof body.customerId === "string";
}

export function prewarmAbacatePayCustomerInBackground(
  source: AbacatePayCustomerPrewarmSource = "unknown"
): void {
  void prewarmAbacatePayCustomer(source).catch((error) => {
    console.error("[abacatepay-customer] prewarm failed", error);
  });
}
