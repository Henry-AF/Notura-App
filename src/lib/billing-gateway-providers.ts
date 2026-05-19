import Stripe from "stripe";
import {
  createAbacatePaySubscriptionCheckout,
  getAbacatePaySubscriptionById,
  getAbacatePayCheckoutExternalId,
  getAbacatePayProductId,
  isAbacatePaySubscriptionPaid,
  parseAbacatePayOnboardingExternalId,
} from "@/lib/abacatepay";
import {
  AbacatePayCustomerNotReadyError,
  ensureAbacatePayCustomer as ensureProviderAbacatePayCustomer,
  loadAbacatePayCustomerContext,
} from "@/lib/abacatepay-customer";
import {
  getOrCreateBillingAccount,
  resetSubscriptionPeriod,
  setAbacatePayAutoRenew as setProviderAbacatePayAutoRenew,
} from "@/lib/billing";
import { BillingGatewayError } from "@/lib/billing-gateway-errors";
import { withBillingSpan } from "@/lib/billing-observability";
import type {
  BillingAutoRenewStatus,
  BillingCheckoutInput,
  BillingCheckoutResult,
  EnsureBillingCustomerInput,
  EnsureBillingCustomerResult,
  VerifyBillingCheckoutInput,
  VerifyBillingCheckoutResult,
} from "@/lib/billing-gateway";
import {
  getAppBaseUrl,
  getStripe,
  getStripePriceId,
  isPaidCheckoutSession,
} from "@/lib/stripe";
import { createServiceRoleClient } from "@/lib/supabase/server";

type PaidPlan = BillingCheckoutInput["plan"];

function getCheckoutReturnPath(source: BillingCheckoutInput["source"]): string {
  return source === "settings" ? "/dashboard" : "/onboarding";
}

function buildCheckoutUrl(
  input: BillingCheckoutInput,
  provider: "stripe" | "abacatepay",
  payment: "success" | "canceled"
): string {
  const appBaseUrl = getAppBaseUrl(input.requestOrigin);
  const url = new URL(getCheckoutReturnPath(input.source), appBaseUrl);
  url.searchParams.set("payment", payment);
  url.searchParams.set("plan", input.plan);
  url.searchParams.set("provider", provider);
  if (provider === "stripe" && payment === "success") {
    url.searchParams.set("session_id", "{CHECKOUT_SESSION_ID}");
  }
  return url
    .toString()
    .replace("%7BCHECKOUT_SESSION_ID%7D", "{CHECKOUT_SESSION_ID}");
}

function buildStripeMetadata(input: BillingCheckoutInput) {
  return {
    user_id: input.userId,
    plan: input.plan,
    provider: "stripe",
    source: input.source,
  };
}

function getStripeCustomerParam(input: {
  stripeCustomerId: string | null;
  userEmail: string | null;
}) {
  if (input.stripeCustomerId) return { customer: input.stripeCustomerId };
  if (input.userEmail) return { customer_email: input.userEmail };
  throw new Error("Seu usuário não possui email válido para iniciar o checkout.");
}

function getStripePeriodEnd(subscription: Stripe.Subscription): string | null {
  const periodEnd = (
    subscription as Stripe.Subscription & { current_period_end?: unknown }
  ).current_period_end;
  return typeof periodEnd === "number"
    ? new Date(periodEnd * 1000).toISOString()
    : null;
}

function getStripeRenewalStatus(subscription: Stripe.Subscription): string {
  if (subscription.cancel_at_period_end) return "canceling";
  return subscription.status || "active";
}

async function saveStripeCustomerId(
  userId: string,
  customerId: string
): Promise<void> {
  const { error } = await createServiceRoleClient()
    .from("billing_accounts")
    .update({
      stripe_customer_id: customerId,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId);

  if (error) {
    throw new Error(`Failed to persist Stripe customer ID: ${error.message}`);
  }
}

async function saveStripePendingCheckout(input: {
  userId: string;
  plan: PaidPlan;
  sessionId: string;
}): Promise<void> {
  const { error } = await createServiceRoleClient()
    .from("billing_accounts")
    .update({
      stripe_pending_checkout_session_id: input.sessionId,
      stripe_pending_plan: input.plan,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", input.userId);

  if (error) {
    throw new Error(`Failed to persist pending Stripe checkout: ${error.message}`);
  }
}

async function saveStripeAutoRenew(input: {
  userId: string;
  enabled: boolean;
  status: string;
}): Promise<void> {
  const { error } = await createServiceRoleClient()
    .from("billing_accounts")
    .update({
      stripe_auto_renew_enabled: input.enabled,
      stripe_auto_renew_updated_at: new Date().toISOString(),
      stripe_renewal_status: input.status,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", input.userId);

  if (error) {
    throw new Error(`Failed to update Stripe auto-renew: ${error.message}`);
  }
}

async function createStripeCustomer(input: EnsureBillingCustomerInput) {
  if (!input.userEmail) {
    throw new Error("Seu usuário precisa ter email válido para iniciar o pagamento.");
  }

  return getStripe().customers.create({
    email: input.userEmail,
    metadata: {
      userId: input.userId,
      origin: input.source,
    },
  });
}

function getAbacatePayCustomerId(
  result: Awaited<ReturnType<typeof ensureProviderAbacatePayCustomer>>
): string {
  if (result.status === "ready" && result.customerId) return result.customerId;
  throw new AbacatePayCustomerNotReadyError();
}

function isPaidPlan(plan: unknown): plan is PaidPlan {
  return plan === "pro" || plan === "team";
}

function readResourceId(value: unknown): string | undefined {
  if (typeof value === "string") return value;
  if (value && typeof value === "object" && "id" in value) {
    const id = (value as { id?: unknown }).id;
    if (typeof id === "string") return id;
  }
  return undefined;
}

function readSubscriptionUserId(
  metadata: Record<string, unknown> | undefined
): string | null {
  if (!metadata) return null;
  if (typeof metadata.userId === "string") return metadata.userId;
  if (typeof metadata.user_id === "string") return metadata.user_id;
  return null;
}

function validateStripeSessionOwner(input: {
  userId: string;
  sessionUserId: string | undefined;
  clientReferenceId: string | null;
}): void {
  if (
    input.sessionUserId !== input.userId ||
    input.clientReferenceId !== input.userId
  ) {
    throw new BillingGatewayError(
      "Sessão de pagamento não pertence ao usuário autenticado.",
      403
    );
  }
}

function validateStripePendingCheckout(input: {
  pendingSessionId: string | null | undefined;
  sessionId: string;
}): void {
  if (input.pendingSessionId !== input.sessionId) {
    throw new BillingGatewayError(
      "Sessão de pagamento não está mais ativa.",
      409
    );
  }
}

function isAlreadyActiveStripeSession(input: {
  billingAccount: Awaited<ReturnType<typeof getOrCreateBillingAccount>>;
  plan: PaidPlan;
  subscriptionId: string | undefined;
}): boolean {
  return (
    input.billingAccount.active_billing_provider === "stripe" &&
    input.billingAccount.plan === input.plan &&
    input.billingAccount.stripe_subscription_id === input.subscriptionId
  );
}

export async function createStripeCheckout(
  input: BillingCheckoutInput
): Promise<BillingCheckoutResult> {
  const billingAccount = await getOrCreateBillingAccount(input.userId);
  if (billingAccount.plan === input.plan) {
    return { provider: "stripe", alreadyActive: true, plan: input.plan };
  }

  const session = await getStripe().checkout.sessions.create({
    mode: "subscription",
    line_items: [{ price: getStripePriceId(input.plan), quantity: 1 }],
    success_url: buildCheckoutUrl(input, "stripe", "success"),
    cancel_url: buildCheckoutUrl(input, "stripe", "canceled"),
    client_reference_id: input.userId,
    metadata: buildStripeMetadata(input),
    subscription_data: {
      metadata: buildStripeMetadata(input),
    },
    ...getStripeCustomerParam({
      stripeCustomerId: billingAccount.stripe_customer_id,
      userEmail: input.userEmail,
    }),
  });

  if (!session.url) {
    throw new Error("Stripe não retornou uma URL de checkout.");
  }

  await saveStripePendingCheckout({
    userId: input.userId,
    plan: input.plan,
    sessionId: session.id,
  });

  return {
    provider: "stripe",
    checkoutUrl: session.url,
  };
}

export async function ensureStripeCustomer(
  input: EnsureBillingCustomerInput
): Promise<EnsureBillingCustomerResult> {
  const billingAccount = await getOrCreateBillingAccount(input.userId);
  if (billingAccount.stripe_customer_id) {
    return {
      provider: "stripe",
      status: "ready",
      customerId: billingAccount.stripe_customer_id,
    };
  }

  const customer = await createStripeCustomer(input);
  await saveStripeCustomerId(input.userId, customer.id);
  return {
    provider: "stripe",
    status: "ready",
    customerId: customer.id,
  };
}

export async function setStripeAutoRenew(input: {
  userId: string;
  enabled: boolean;
  stripeSubscriptionId: string;
}): Promise<BillingAutoRenewStatus> {
  const subscription = await getStripe().subscriptions.update(
    input.stripeSubscriptionId,
    {
      cancel_at_period_end: !input.enabled,
    }
  );
  const renewalStatus = getStripeRenewalStatus(subscription);
  await saveStripeAutoRenew({
    userId: input.userId,
    enabled: input.enabled,
    status: renewalStatus,
  });

  return {
    provider: "stripe",
    autoRenewEnabled: input.enabled,
    currentPeriodEnd: getStripePeriodEnd(subscription),
    renewalStatus,
  };
}

export async function verifyStripeCheckout(
  input: VerifyBillingCheckoutInput & { sessionId: string }
): Promise<VerifyBillingCheckoutResult> {
  const db = createServiceRoleClient();
  const billingAccount = await getOrCreateBillingAccount(input.userId, db);
  const session = await getStripe().checkout.sessions.retrieve(input.sessionId);
  const plan = session.metadata?.plan;

  validateStripeSessionOwner({
    userId: input.userId,
    sessionUserId: session.metadata?.user_id,
    clientReferenceId: session.client_reference_id,
  });

  if (!isPaidPlan(plan)) {
    throw new BillingGatewayError("Plano inválido na sessão de checkout.", 400);
  }
  if (session.mode !== "subscription") {
    throw new BillingGatewayError("Sessão de checkout inválida para assinatura.", 400);
  }
  if (!isPaidCheckoutSession(session)) {
    throw new BillingGatewayError(
      "Pagamento ainda não foi confirmado pela Stripe.",
      409
    );
  }

  const stripeCustomerId = readResourceId(session.customer);
  const stripeSubscriptionId = readResourceId(session.subscription);
  if (billingAccount.stripe_pending_checkout_session_id !== session.id) {
    if (
      isAlreadyActiveStripeSession({
        billingAccount,
        plan,
        subscriptionId: stripeSubscriptionId,
      })
    ) {
      return {
        provider: "stripe",
        success: true,
        plan,
        paymentStatus: session.payment_status,
      };
    }
    validateStripePendingCheckout({
      pendingSessionId: billingAccount.stripe_pending_checkout_session_id,
      sessionId: session.id,
    });
  }

  await resetSubscriptionPeriod(
    {
      userId: input.userId,
      plan,
      stripeCustomerId,
      stripeSubscriptionId,
    },
    db
  );

  return {
    provider: "stripe",
    success: true,
    plan,
    paymentStatus: session.payment_status,
  };
}

export async function createAbacatePayCheckout(
  input: BillingCheckoutInput
): Promise<BillingCheckoutResult> {
  const db = createServiceRoleClient();
  const context = await loadAbacatePayCustomerContext(db, input.userId, input.source);
  if (context.billingAccount.plan === input.plan) {
    return { provider: "abacatepay", alreadyActive: true, plan: input.plan };
  }

  const customer = await ensureProviderAbacatePayCustomer(
    db,
    { id: input.userId, email: input.userEmail },
    context,
    { source: input.source, waitForFreshLock: true }
  );
  const customerId = getAbacatePayCustomerId(customer);
  const subscription = await createAbacatePaySubscription(input, customerId);
  await saveAbacatePayPendingCheckout(input, customerId, subscription.id);

  return {
    provider: "abacatepay",
    checkoutUrl: subscription.url,
  };
}

export async function ensureAbacatePayCustomer(
  input: EnsureBillingCustomerInput
): Promise<EnsureBillingCustomerResult> {
  const db = createServiceRoleClient();
  const context = await loadAbacatePayCustomerContext(db, input.userId, input.source);
  const result = await ensureProviderAbacatePayCustomer(
    db,
    { id: input.userId, email: input.userEmail },
    context,
    { source: input.source }
  );
  return { provider: "abacatepay", ...result };
}

export async function setAbacatePayAutoRenew(input: {
  userId: string;
  enabled: boolean;
}): Promise<BillingAutoRenewStatus> {
  const status = await setProviderAbacatePayAutoRenew(input.userId, input.enabled);
  return {
    provider: "abacatepay",
    ...status,
  };
}

export async function verifyAbacatePayCheckout(
  input: Pick<VerifyBillingCheckoutInput, "userId">
): Promise<VerifyBillingCheckoutResult> {
  const db = createServiceRoleClient();
  const billingAccount = await getOrCreateBillingAccount(input.userId, db);

  if (!billingAccount.abacatepay_pending_checkout_id) {
    if (billingAccount.plan !== "free" && isPaidPlan(billingAccount.plan)) {
      return { provider: "abacatepay", success: true, plan: billingAccount.plan };
    }
    throw new BillingGatewayError(
      "Nenhum checkout pendente encontrado para este usuario.",
      409
    );
  }

  const pendingPlan = getAbacatePayPendingPlan(billingAccount.abacatepay_pending_plan);
  const subscription = await getAbacatePaySubscriptionById(
    billingAccount.abacatepay_pending_checkout_id
  );
  if (!subscription) {
    throw new BillingGatewayError("Checkout pendente nao encontrado no AbacatePay.", 404);
  }

  validateAbacatePaySubscriptionOwner(subscription, input.userId, pendingPlan);
  if (!isAbacatePaySubscriptionPaid(subscription)) {
    throw new BillingGatewayError(
      "Pagamento ainda nao foi confirmado pelo AbacatePay.",
      409
    );
  }

  await resetSubscriptionPeriod(
    {
      userId: input.userId,
      plan: pendingPlan,
      abacatepayCustomerId:
        subscription.customerId ?? billingAccount.abacatepay_customer_id ?? undefined,
      clearAbacatePayPending: true,
    },
    db
  );

  return { provider: "abacatepay", success: true, plan: pendingPlan };
}

function getAbacatePayPendingPlan(plan: string | null): PaidPlan {
  if (isPaidPlan(plan)) return plan;
  throw new BillingGatewayError("Plano pendente invalido para verificacao.", 400);
}

function validateAbacatePaySubscriptionOwner(
  subscription: NonNullable<Awaited<ReturnType<typeof getAbacatePaySubscriptionById>>>,
  userId: string,
  pendingPlan: PaidPlan
): void {
  const externalId =
    typeof subscription.externalId === "string" ? subscription.externalId : null;
  const parsedExternalId = externalId
    ? parseAbacatePayOnboardingExternalId(externalId)
    : null;

  if (
    externalId &&
    (!parsedExternalId ||
      parsedExternalId.userId !== userId ||
      parsedExternalId.plan !== pendingPlan)
  ) {
    throw new BillingGatewayError(
      "Checkout nao pertence ao usuario autenticado.",
      403
    );
  }

  const subscriptionUserId = readSubscriptionUserId(subscription.metadata);
  if (subscriptionUserId && subscriptionUserId !== userId) {
    throw new BillingGatewayError(
      "Metadados do pagamento nao pertencem ao usuario autenticado.",
      403
    );
  }
}

async function createAbacatePaySubscription(
  input: BillingCheckoutInput,
  customerId: string
) {
  return withBillingSpan(
    {
      name: "billing.abacatepay.create_subscription_checkout",
      op: "http.client",
      attributes: {
        "billing.dependency": "abacatepay",
        "billing.flow": input.source,
      },
    },
    () =>
      createAbacatePaySubscriptionCheckout({
        productId: getAbacatePayProductId(input.plan),
        customerId,
        externalId: getAbacatePayCheckoutExternalId(input.userId, input.plan),
        returnUrl: buildCheckoutUrl(input, "abacatepay", "canceled"),
        completionUrl: buildCheckoutUrl(input, "abacatepay", "success"),
        metadata: {
          userId: input.userId,
          plan: input.plan,
          origin: input.source,
        },
      })
  ).then((subscription) => {
    if (!subscription.id || !subscription.url) {
      throw new Error("AbacatePay não retornou um checkout válido.");
    }
    return { id: subscription.id, url: subscription.url };
  });
}

async function saveAbacatePayPendingCheckout(
  input: BillingCheckoutInput,
  customerId: string,
  checkoutId: string
): Promise<void> {
  const { error } = await createServiceRoleClient()
    .from("billing_accounts")
    .update({
      abacatepay_customer_id: customerId,
      abacatepay_pending_checkout_id: checkoutId,
      abacatepay_pending_plan: input.plan as PaidPlan,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", input.userId);

  if (error) {
    throw new Error(`Não foi possível salvar o checkout pendente: ${error.message}`);
  }
}
