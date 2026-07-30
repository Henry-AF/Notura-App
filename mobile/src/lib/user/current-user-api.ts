import { fetchApi } from "@/lib/api/client";
import { normalizeError, parseJson } from "@/lib/api-client";

export type Plan = "free" | "pro" | "team";

export interface CurrentUser {
  name: string;
  email: string;
  company: string;
  plan: Plan;
  meetingsThisMonth: number;
  monthlyLimit: number | null;
  currentPeriodEnd: string | null;
  autoRenewEnabled: boolean;
  renewalStatus: string;
}

interface CurrentUserApiResponse {
  user?: Partial<CurrentUser>;
  error?: string;
}

function mapCurrentUser(user: Partial<CurrentUser>): CurrentUser {
  return {
    name: user.name ?? "",
    email: user.email ?? "",
    company: user.company ?? "",
    plan: user.plan ?? "free",
    meetingsThisMonth: user.meetingsThisMonth ?? 0,
    monthlyLimit: user.monthlyLimit ?? null,
    currentPeriodEnd: user.currentPeriodEnd ?? null,
    autoRenewEnabled: user.autoRenewEnabled ?? true,
    renewalStatus: user.renewalStatus ?? "idle",
  };
}

export async function fetchCurrentUser(): Promise<CurrentUser> {
  const response = await fetchApi("/api/user/me");
  const body = await parseJson<CurrentUserApiResponse>(response);

  if (!response.ok || !body.user) {
    throw new Error(normalizeError(body.error, "Erro ao carregar usuário."));
  }

  return mapCurrentUser(body.user);
}

export interface UpdateCurrentUserInput {
  name?: string;
  company?: string;
}

export async function updateCurrentUser(input: UpdateCurrentUserInput): Promise<CurrentUser> {
  const response = await fetchApi("/api/user/me", {
    method: "PATCH",
    body: JSON.stringify(input),
  });
  const body = await parseJson<CurrentUserApiResponse>(response);

  if (!response.ok || !body.user) {
    throw new Error(normalizeError(body.error, "Erro ao atualizar usuário."));
  }

  return mapCurrentUser(body.user);
}

export interface AutoRenewStatus {
  autoRenewEnabled: boolean;
  currentPeriodEnd: string | null;
  renewalStatus: string;
}

interface AutoRenewApiResponse extends Partial<AutoRenewStatus> {
  error?: string;
}

export async function updateAutoRenew(enabled: boolean): Promise<AutoRenewStatus> {
  const response = await fetchApi("/api/billing/auto-renew", {
    method: "PATCH",
    body: JSON.stringify({ enabled }),
  });
  const body = await parseJson<AutoRenewApiResponse>(response);

  if (!response.ok || typeof body.autoRenewEnabled !== "boolean") {
    throw new Error(
      normalizeError(body.error, "Não foi possível atualizar a renovação automática.")
    );
  }

  return {
    autoRenewEnabled: body.autoRenewEnabled,
    currentPeriodEnd: body.currentPeriodEnd ?? null,
    renewalStatus: body.renewalStatus ?? "idle",
  };
}

// Mirrors `src/lib/plans.ts` + `src/lib/pricing.ts` on the web — just the
// three display titles, not the full pricing catalog (mobile doesn't do
// checkout, see NOT-153/NOT-135).
const PLAN_TITLES: Record<Plan, string> = {
  free: "Plano Free",
  pro: "Plano Starter",
  team: "Plano Pro",
};

export function getPlanTitle(plan: Plan): string {
  return PLAN_TITLES[plan];
}
