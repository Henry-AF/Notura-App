import { normalizeError, parseJson } from "@/lib/api-client";
import type {
  CurrentUser,
  UpdateCurrentUserInput,
} from "./current-user-types";

interface CurrentUserResponse {
  user?: CurrentUser;
  error?: string;
}

interface ErrorResponse {
  error?: string;
}

function resolveCurrentUser(
  response: Response,
  body: CurrentUserResponse
): CurrentUser {
  if (!response.ok || !body.user) {
    throw new Error(body.error ?? "Erro ao carregar usuário.");
  }

  return body.user;
}

export async function fetchCurrentUser(): Promise<CurrentUser> {
  const response = await fetch("/api/user/me", { method: "GET" });
  const body = await parseJson<CurrentUserResponse>(response);
  return resolveCurrentUser(response, body);
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

export async function logoutCurrentUser(): Promise<void> {
  const response = await fetch("/api/auth/logout", { method: "POST" });
  if (response.ok) {
    return;
  }

  let body: ErrorResponse = {};
  try {
    body = await parseJson<ErrorResponse>(response);
  } catch {}

  throw new Error(normalizeError(body.error, "Erro ao encerrar sessão."));
}
