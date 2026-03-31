import type { BillingAccount, Plan } from "@/types/database";

const ABACATEPAY_API_BASE_URL = (
  process.env.ABACATEPAY_API_BASE_URL || "https://api.abacatepay.com/v1"
).trim();
const ABACATEPAY_API_KEY = process.env.ABACATEPAY_API_KEY;

const ABACATEPAY_PLAN_PRODUCT_IDS: Record<Exclude<Plan, "free">, string> = {
  pro: process.env.ABACATEPAY_PRO_PRODUCT_ID || "",
  team: process.env.ABACATEPAY_PLATINUM_PRODUCT_ID || ""
};

interface AbacatePayEnvelope<T> {
  data: T;
  error?: {
    message?: string;
  };
}

interface AbacatePayCustomer {
  id: string;
  email?: string;
  name?: string;
  cellphone?: string;
}

interface AbacatePaySubscription {
  id: string;
  url?: string;
  status?: string;
  customerId?: string;
  externalId?: string;
  metadata?: Record<string, unknown>;
}

function getHeaders(): HeadersInit {
  if (!ABACATEPAY_API_KEY) {
    throw new Error("Missing ABACATEPAY_API_KEY");
  }

  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${ABACATEPAY_API_KEY}`,
  };
}

async function parseResponse<T>(response: Response): Promise<T> {
  const data = (await response.json()) as
    | AbacatePayEnvelope<T>
    | { error?: { message?: string }; message?: string };

  if (!response.ok) {
    const message =
      "error" in data && data.error?.message
        ? data.error.message
        : "message" in data && typeof data.message === "string"
          ? data.message
        : `HTTP ${response.status}`;
    throw new Error(message);
  }

  if (
    "error" in data &&
    data.error?.message &&
    (!("data" in data) || typeof data.data === "undefined")
  ) {
    throw new Error(data.error.message);
  }

  if (!("data" in data) || typeof data.data === "undefined") {
    throw new Error("AbacatePay response missing data payload");
  }

  return data.data;
}

export function getAbacatePayProductId(plan: Plan): string {
  if (plan === "free") {
    throw new Error("Free plan does not use AbacatePay checkout");
  }

  return ABACATEPAY_PLAN_PRODUCT_IDS[plan];
}

export async function createAbacatePayCustomer(input: {
  email: string;
  name?: string | null;
  cellphone?: string | null;
  metadata?: Record<string, unknown>;
}): Promise<AbacatePayCustomer> {
  const response = await fetch(
    `${ABACATEPAY_API_BASE_URL.replace(/\/+$/, "")}/customers/create`,
    {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify({
        email: input.email,
        ...(input.name ? { name: input.name } : {}),
        ...(input.cellphone ? { cellphone: input.cellphone } : {}),
        ...(input.metadata ? { metadata: input.metadata } : {}),
      }),
    }
  );

  return parseResponse<AbacatePayCustomer>(response);
}

export async function createAbacatePaySubscriptionCheckout(input: {
  productId: string;
  customerId: string;
  externalId: string;
  returnUrl: string;
  completionUrl: string;
  metadata?: Record<string, unknown>;
}): Promise<AbacatePaySubscription> {
  const response = await fetch(
    `${ABACATEPAY_API_BASE_URL.replace(/\/+$/, "")}/subscriptions/create`,
    {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify({
        items: [{ id: input.productId, quantity: 1 }],
        customerId: input.customerId,
        externalId: input.externalId,
        returnUrl: input.returnUrl,
        completionUrl: input.completionUrl,
        methods: ["CARD"],
        ...(input.metadata ? { metadata: input.metadata } : {}),
      }),
    }
  );

  return parseResponse<AbacatePaySubscription>(response);
}

export async function getAbacatePaySubscriptionById(
  subscriptionId: string
): Promise<AbacatePaySubscription | null> {
  const url = new URL(
    `${ABACATEPAY_API_BASE_URL.replace(/\/+$/, "")}/subscriptions/list`
  );
  url.searchParams.set("id", subscriptionId);

  const response = await fetch(url.toString(), {
    method: "GET",
    headers: getHeaders(),
  });

  const data = await parseResponse<AbacatePaySubscription[]>(response);
  return data[0] ?? null;
}

export function isAbacatePaySubscriptionPaid(
  subscription: AbacatePaySubscription
): boolean {
  return subscription.status === "paid" || subscription.status === "PAID";
}

export function getAbacatePayPendingExternalId(
  userId: string,
  plan: Exclude<Plan, "free">
): string {
  return `onboarding:${userId}:${plan}`;
}

export function getAbacatePayCustomerPhone(
  billingAccount: BillingAccount,
  phone?: string | null
): string | null {
  return billingAccount.abacatepay_customer_id
    ? null
    : phone || null;
}
