import { normalizeError, parseJson } from "@/lib/api-client";
import type { Plan } from "@/types/database";

export interface CurrentUser {
  id: string;
  email: string;
  name: string;
  company: string;
  whatsappNumber: string;
  plan: Plan;
  meetingsThisMonth: number;
  monthlyLimit: number | null;
}

interface CurrentUserResponse {
  user?: CurrentUser;
  error?: string;
}

export interface UpdateCurrentUserInput {
  name?: string;
  company?: string;
  whatsappNumber?: string | null;
}

export async function fetchCurrentUser(): Promise<CurrentUser> {
  const response = await fetch("/api/user/me", { method: "GET" });
  const body = await parseJson<CurrentUserResponse>(response);

  if (!response.ok || !body.user) {
    throw new Error(body.error ?? "Erro ao carregar usuário.");
  }

  return body.user;
}

export async function updateCurrentUser(
  input: UpdateCurrentUserInput
): Promise<CurrentUser> {
  const response = await fetch("/api/user/me", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const body = await parseJson<CurrentUserResponse>(response);

  if (!response.ok || !body.user) {
    throw new Error(normalizeError(body.error, "Erro ao atualizar usuário."));
  }

  return body.user;
}
