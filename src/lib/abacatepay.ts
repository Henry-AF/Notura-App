import type { BillingAccount, Plan } from "@/types/database";

const ABACATEPAY_API_BASE_URL = (
  process.env.ABACATEPAY_API_BASE_URL || "https://api.abacatepay.com/v1"
).trim();
const ABACATEPAY_API_KEY = process.env.ABACATEPAY_API_KEY;
export const ABACATEPAY_REQUEST_TIMEOUT_MS = 5000;

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

export class AbacatePayTimeoutError extends Error {
  constructor(operation: string, timeoutMs = ABACATEPAY_REQUEST_TIMEOUT_MS) {
    super(`AbacatePay timed out during ${operation} after ${timeoutMs}ms`);
    this.name = "AbacatePayTimeoutError";
  }
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

async function fetchAbacatePay<T>(
  path: string,
  init: RequestInit,
  operation: string,
  timeoutMs = ABACATEPAY_REQUEST_TIMEOUT_MS
): Promise<T> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(
      `${ABACATEPAY_API_BASE_URL.replace(/\/+$/, "")}${path}`,
      {
        ...init,
        headers: {
          ...getHeaders(),
          ...(init.headers ?? {}),
        },
        signal: controller.signal,
      }
    );

    return await parseResponse<T>(response);
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new AbacatePayTimeoutError(operation, timeoutMs);
    }

    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

export function isAbacatePayTimeoutError(
  error: unknown
): error is AbacatePayTimeoutError {
  return error instanceof AbacatePayTimeoutError;
}

export function getAbacatePayProductId(plan: Plan): string {
  if (plan === "free") {
    throw new Error("Free plan does not use AbacatePay checkout");
  }

  const productId = ABACATEPAY_PLAN_PRODUCT_IDS[plan];
  if (!productId) {
    throw new Error(`Missing AbacatePay product ID for plan '${plan}'`);
  }

  return productId;
}

export async function createAbacatePayCustomer(input: {
  email: string;
  name?: string | null;
  cellphone?: string | null;
  metadata?: Record<string, unknown>;
}): Promise<AbacatePayCustomer> {
  return fetchAbacatePay<AbacatePayCustomer>(
    "/customers/create",
    {
      method: "POST",
      body: JSON.stringify({
        email: input.email,
        ...(input.name ? { name: input.name } : {}),
        ...(input.cellphone ? { cellphone: input.cellphone } : {}),
        ...(input.metadata ? { metadata: input.metadata } : {}),
      }),
    },
    "customers/create"
  );
}

export async function createAbacatePaySubscriptionCheckout(input: {
  productId: string;
  customerId: string;
  externalId: string;
  returnUrl: string;
  completionUrl: string;
  metadata?: Record<string, unknown>;
}): Promise<AbacatePaySubscription> {
  return fetchAbacatePay<AbacatePaySubscription>(
    "/subscriptions/create",
    {
      method: "POST",
      body: JSON.stringify({
        items: [{ id: input.productId, quantity: 1 }],
        customerId: input.customerId,
        externalId: input.externalId,
        returnUrl: input.returnUrl,
        completionUrl: input.completionUrl,
        methods: ["CARD"],
        ...(input.metadata ? { metadata: input.metadata } : {}),
      }),
    },
    "subscriptions/create"
  );
}

export async function getAbacatePaySubscriptionById(
  subscriptionId: string
): Promise<AbacatePaySubscription | null> {
  const url = new URL(
    "/subscriptions/list",
    `${ABACATEPAY_API_BASE_URL.replace(/\/+$/, "")}/`
  );
  url.searchParams.set("id", subscriptionId);

  const data = await fetchAbacatePay<AbacatePaySubscription[]>(
    `${url.pathname}${url.search}`,
    {
      method: "GET",
    },
    "subscriptions/list"
  );
  return data[0] ?? null;
}

export function isAbacatePaySubscriptionPaid(
  subscription: AbacatePaySubscription
): boolean {
  const normalizedStatus = subscription.status?.trim().toUpperCase();
  return normalizedStatus === "PAID" || normalizedStatus === "ACTIVE";
}

export function getAbacatePayPendingExternalId(
  userId: string,
  plan: Exclude<Plan, "free">
): string {
  return `onboarding:${userId}:${plan}`;
}

export function getAbacatePayCheckoutExternalId(
  userId: string,
  plan: Exclude<Plan, "free">,
  nonce = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
): string {
  return `${getAbacatePayPendingExternalId(userId, plan)}:${nonce}`;
}

export function parseAbacatePayOnboardingExternalId(
  externalId: string
): { userId: string; plan: Exclude<Plan, "free"> } | null {
  const trimmed = externalId.trim();
  if (!trimmed) return null;

  const [origin, userId, plan] = trimmed.split(":");

  if (origin !== "onboarding" || !userId) return null;
  if (plan !== "pro" && plan !== "team") return null;

  return { userId, plan };
}

export function getAbacatePayCustomerPhone(
  billingAccount: BillingAccount,
  phone?: string | null
): string | null {
  if (billingAccount.abacatepay_customer_id || !phone) {
    return null;
  }

  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("55") && (digits.length === 12 || digits.length === 13)) {
    return digits.slice(2);
  }

  return digits || null;
}
