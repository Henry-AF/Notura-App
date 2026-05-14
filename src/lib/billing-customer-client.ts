interface BillingCustomerPrewarmResponse {
  success?: boolean;
  customerId?: string;
}

export type BillingCustomerPrewarmSource =
  | "onboarding"
  | "settings"
  | "unknown";

export async function prewarmBillingCustomer(
  source: BillingCustomerPrewarmSource = "unknown"
): Promise<boolean> {
  const response = await fetch("/api/billing/customer/ensure", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ source }),
  });

  if (!response.ok || response.status === 202) {
    return false;
  }

  let body: BillingCustomerPrewarmResponse = {};
  try {
    body = (await response.json()) as BillingCustomerPrewarmResponse;
  } catch {
    return false;
  }

  return body.success === true && typeof body.customerId === "string";
}

export function prewarmBillingCustomerInBackground(
  source: BillingCustomerPrewarmSource = "unknown"
): void {
  void prewarmBillingCustomer(source).catch((error) => {
    console.error("[billing-customer] prewarm failed", error);
  });
}
