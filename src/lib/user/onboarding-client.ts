import { normalizeError, parseJson } from "@/lib/api-client";
import type {
  UpdateUserOnboardingInput,
  UserOnboardingState,
} from "./onboarding";

interface OnboardingResponse {
  onboarding?: UserOnboardingState;
  error?: string;
}

function resolveOnboardingState(
  response: Response,
  body: OnboardingResponse
): UserOnboardingState {
  if (!response.ok || !body.onboarding) {
    throw new Error(normalizeError(body.error, "Erro ao carregar onboarding."));
  }

  return body.onboarding;
}

export async function fetchUserOnboardingState(): Promise<UserOnboardingState> {
  const response = await fetch("/api/user/onboarding", {
    method: "GET",
    cache: "no-store",
  });
  const body = await parseJson<OnboardingResponse>(response);
  return resolveOnboardingState(response, body);
}

export async function updateUserOnboardingState(
  input: UpdateUserOnboardingInput
): Promise<UserOnboardingState> {
  const response = await fetch("/api/user/onboarding", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const body = await parseJson<OnboardingResponse>(response);
  return resolveOnboardingState(response, body);
}
