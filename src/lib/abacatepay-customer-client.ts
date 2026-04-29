interface AbacatePayCustomerPrewarmResponse {
  success?: boolean;
  customerId?: string;
}

export async function prewarmAbacatePayCustomer(): Promise<boolean> {
  const response = await fetch("/api/abacatepay/customer/ensure", {
    method: "POST",
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

export function prewarmAbacatePayCustomerInBackground(): void {
  void prewarmAbacatePayCustomer().catch((error) => {
    console.error("[abacatepay-customer] prewarm failed", error);
  });
}
