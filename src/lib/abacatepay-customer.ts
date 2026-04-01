import type { SupabaseClient } from "@supabase/supabase-js";
import {
  createAbacatePayCustomer,
  getAbacatePayCustomerPhone,
  isAbacatePayTimeoutError,
} from "@/lib/abacatepay";
import { getOrCreateBillingAccount } from "@/lib/billing";
import type { BillingAccount, Database, Profile } from "@/types/database";

const ABACATEPAY_CUSTOMER_SYNC_STALE_MS = 30_000;
const ABACATEPAY_CUSTOMER_WAIT_INTERVAL_MS = 250;
const DEFAULT_WAIT_FOR_CUSTOMER_SYNC_MS = 5_500;

export interface AbacatePayAuthenticatedUser {
  id: string;
  email: string | null;
  phone: string | null;
}

export interface AbacatePayCustomerContext {
  billingAccount: BillingAccount;
  profile: Pick<Profile, "name" | "whatsapp_number"> | null;
}

interface BillingCustomerState {
  abacatepay_customer_id: string | null;
  abacatepay_customer_sync_started_at: string | null;
}

interface EnsureAbacatePayCustomerOptions {
  waitForFreshLock?: boolean;
  maxWaitMs?: number;
}

interface EnsureAbacatePayCustomerResult {
  status: "ready" | "in_progress";
  customerId?: string;
}

export class AbacatePayCustomerNotReadyError extends Error {
  constructor() {
    super("Estamos preparando seu checkout. Tente novamente em alguns segundos.");
    this.name = "AbacatePayCustomerNotReadyError";
  }
}

export async function loadAbacatePayCustomerContext(
  supabase: SupabaseClient<Database>,
  userId: string
): Promise<AbacatePayCustomerContext> {
  const [billingAccount, profileResult] = await Promise.all([
    getOrCreateBillingAccount(userId, supabase),
    supabase
      .from("profiles")
      .select("name, whatsapp_number")
      .eq("id", userId)
      .maybeSingle(),
  ]);

  if (profileResult.error) {
    throw new Error("Nao foi possivel carregar seu perfil para o checkout.");
  }

  return {
    billingAccount,
    profile: profileResult.data ?? null,
  };
}

function hasFreshCustomerSyncLock(startedAt: string | null): boolean {
  if (!startedAt) {
    return false;
  }

  return Date.now() - new Date(startedAt).getTime() < ABACATEPAY_CUSTOMER_SYNC_STALE_MS;
}

async function readBillingCustomerState(
  supabase: SupabaseClient<Database>,
  userId: string
): Promise<BillingCustomerState> {
  const { data, error } = await supabase
    .from("billing_accounts")
    .select("abacatepay_customer_id, abacatepay_customer_sync_started_at")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load billing customer state: ${error.message}`);
  }

  if (!data) {
    throw new Error("Billing account not found for authenticated user.");
  }

  return data;
}

async function claimCustomerSyncLock(
  supabase: SupabaseClient<Database>,
  userId: string
): Promise<boolean> {
  const nowIso = new Date().toISOString();
  const staleIso = new Date(
    Date.now() - ABACATEPAY_CUSTOMER_SYNC_STALE_MS
  ).toISOString();

  const nullLockClaim = await supabase
    .from("billing_accounts")
    .update({
      abacatepay_customer_sync_started_at: nowIso,
      updated_at: nowIso,
    })
    .eq("user_id", userId)
    .is("abacatepay_customer_id", null)
    .is("abacatepay_customer_sync_started_at", null)
    .select("user_id")
    .maybeSingle();

  if (nullLockClaim.error) {
    throw new Error(
      `Failed to claim customer sync lock: ${nullLockClaim.error.message}`
    );
  }

  if (nullLockClaim.data) {
    return true;
  }

  const staleLockClaim = await supabase
    .from("billing_accounts")
    .update({
      abacatepay_customer_sync_started_at: nowIso,
      updated_at: nowIso,
    })
    .eq("user_id", userId)
    .is("abacatepay_customer_id", null)
    .lt("abacatepay_customer_sync_started_at", staleIso)
    .select("user_id")
    .maybeSingle();

  if (staleLockClaim.error) {
    throw new Error(
      `Failed to reclaim stale customer sync lock: ${staleLockClaim.error.message}`
    );
  }

  return Boolean(staleLockClaim.data);
}

async function clearCustomerSyncLock(
  supabase: SupabaseClient<Database>,
  userId: string
): Promise<void> {
  const { error } = await supabase
    .from("billing_accounts")
    .update({
      abacatepay_customer_sync_started_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId);

  if (error) {
    throw new Error(`Failed to clear customer sync lock: ${error.message}`);
  }
}

async function saveCustomerId(
  supabase: SupabaseClient<Database>,
  userId: string,
  customerId: string
): Promise<void> {
  const { error } = await supabase
    .from("billing_accounts")
    .update({
      abacatepay_customer_id: customerId,
      abacatepay_customer_sync_started_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId);

  if (error) {
    throw new Error(`Failed to persist AbacatePay customer ID: ${error.message}`);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForCustomerSync(
  supabase: SupabaseClient<Database>,
  userId: string,
  maxWaitMs: number
): Promise<string | null> {
  const deadline = Date.now() + maxWaitMs;

  while (Date.now() < deadline) {
    await sleep(ABACATEPAY_CUSTOMER_WAIT_INTERVAL_MS);

    const billingState = await readBillingCustomerState(supabase, userId);
    if (billingState.abacatepay_customer_id) {
      return billingState.abacatepay_customer_id;
    }

    if (!hasFreshCustomerSyncLock(billingState.abacatepay_customer_sync_started_at)) {
      return null;
    }
  }

  return null;
}

export async function ensureAbacatePayCustomer(
  supabase: SupabaseClient<Database>,
  user: AbacatePayAuthenticatedUser,
  context: AbacatePayCustomerContext,
  options: EnsureAbacatePayCustomerOptions = {}
): Promise<EnsureAbacatePayCustomerResult> {
  if (context.billingAccount.abacatepay_customer_id) {
    return {
      status: "ready",
      customerId: context.billingAccount.abacatepay_customer_id,
    };
  }

  if (!user.email) {
    throw new Error("Seu usuario precisa ter email valido para iniciar o pagamento.");
  }

  const billingState = await readBillingCustomerState(supabase, user.id);
  if (billingState.abacatepay_customer_id) {
    return {
      status: "ready",
      customerId: billingState.abacatepay_customer_id,
    };
  }

  const waitForFreshLock = options.waitForFreshLock ?? false;
  const maxWaitMs = options.maxWaitMs ?? DEFAULT_WAIT_FOR_CUSTOMER_SYNC_MS;

  if (hasFreshCustomerSyncLock(billingState.abacatepay_customer_sync_started_at)) {
    if (!waitForFreshLock) {
      return { status: "in_progress" };
    }

    const readyCustomerId = await waitForCustomerSync(
      supabase,
      user.id,
      maxWaitMs
    );
    if (!readyCustomerId) {
      throw new AbacatePayCustomerNotReadyError();
    }

    return {
      status: "ready",
      customerId: readyCustomerId,
    };
  }

  const claimedLock = await claimCustomerSyncLock(supabase, user.id);
  if (!claimedLock) {
    if (!waitForFreshLock) {
      return { status: "in_progress" };
    }

    const readyCustomerId = await waitForCustomerSync(
      supabase,
      user.id,
      maxWaitMs
    );
    if (!readyCustomerId) {
      throw new AbacatePayCustomerNotReadyError();
    }

    return {
      status: "ready",
      customerId: readyCustomerId,
    };
  }

  let createdCustomerId: string | null = null;

  try {
    const customerPhone = getAbacatePayCustomerPhone(
      context.billingAccount,
      user.phone || context.profile?.whatsapp_number || null
    );
    const customer = await createAbacatePayCustomer({
      email: user.email,
      name: context.profile?.name || undefined,
      cellphone: customerPhone,
      metadata: {
        userId: user.id,
        origin: "onboarding",
      },
    });

    createdCustomerId = customer.id;
    await saveCustomerId(supabase, user.id, customer.id);

    return {
      status: "ready",
      customerId: customer.id,
    };
  } catch (error) {
    if (isAbacatePayTimeoutError(error)) {
      console.error(`[abacatepay-customer] customer timeout user=${user.id}`);
    }

    if (!createdCustomerId && !isAbacatePayTimeoutError(error)) {
      await clearCustomerSyncLock(supabase, user.id);
    }

    throw error;
  }
}
