import {
  createAbacatePayCheckout,
  createStripeCheckout,
  ensureAbacatePayCustomer,
  ensureStripeCustomer,
  setAbacatePayAutoRenew,
  setStripeAutoRenew,
  verifyAbacatePayCheckout,
  verifyStripeCheckout,
} from "@/lib/billing-gateway-providers";
import type { BillingCycle } from "@/lib/pricing";
import type { Plan } from "@/types/database";

export type BillingGatewayProvider = "stripe" | "abacatepay";
export type BillingGatewaySource = "onboarding" | "settings" | "unknown";

export interface BillingCheckoutInput {
  userId: string;
  userEmail: string | null;
  plan: Exclude<Plan, "free">;
  source: BillingGatewaySource;
  requestOrigin: string;
  billingCycle: BillingCycle;
}

export interface BillingCheckoutResult {
  provider: BillingGatewayProvider;
  checkoutUrl?: string;
  alreadyActive?: boolean;
  plan?: Exclude<Plan, "free">;
}

export interface EnsureBillingCustomerInput {
  userId: string;
  userEmail: string | null;
  source: BillingGatewaySource;
}

export interface EnsureBillingCustomerResult {
  provider: BillingGatewayProvider;
  status: "ready" | "in_progress";
  customerId?: string;
}

export interface BillingAutoRenewInput {
  userId: string;
  enabled: boolean;
  stripeSubscriptionId?: string | null;
}

export interface BillingAutoRenewStatus {
  provider: BillingGatewayProvider;
  autoRenewEnabled: boolean;
  currentPeriodEnd: string | null;
  renewalStatus: string;
}

export interface VerifyBillingCheckoutInput {
  userId: string;
  sessionId?: string | null;
}

export interface VerifyBillingCheckoutResult {
  provider: BillingGatewayProvider;
  success: true;
  plan: Exclude<Plan, "free">;
  paymentStatus?: string;
}

export async function createBillingCheckout(
  input: BillingCheckoutInput
): Promise<BillingCheckoutResult> {
  try {
    return await createStripeCheckout(input);
  } catch (error) {
    console.error("[billing-gateway] Stripe checkout failed; falling back.", error);
    return createAbacatePayCheckout(input);
  }
}

export async function ensureBillingCustomer(
  input: EnsureBillingCustomerInput
): Promise<EnsureBillingCustomerResult> {
  try {
    return await ensureStripeCustomer(input);
  } catch (error) {
    console.error("[billing-gateway] Stripe prewarm failed; falling back.", error);
    return ensureAbacatePayCustomer(input);
  }
}

export async function updateBillingAutoRenew(
  input: BillingAutoRenewInput
): Promise<BillingAutoRenewStatus> {
  if (input.stripeSubscriptionId) {
    return setStripeAutoRenew({
      userId: input.userId,
      enabled: input.enabled,
      stripeSubscriptionId: input.stripeSubscriptionId,
    });
  }

  return setAbacatePayAutoRenew({
    userId: input.userId,
    enabled: input.enabled,
  });
}

export async function verifyBillingCheckout(
  input: VerifyBillingCheckoutInput
): Promise<VerifyBillingCheckoutResult> {
  const sessionId = input.sessionId?.trim();
  if (sessionId) {
    return verifyStripeCheckout({ userId: input.userId, sessionId });
  }
  return verifyAbacatePayCheckout({ userId: input.userId });
}
