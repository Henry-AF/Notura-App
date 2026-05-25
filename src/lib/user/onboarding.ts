import { createServiceRoleClient } from "@/lib/supabase/server";

export type UserOnboardingPhase = 0 | 1 | 2;

export interface UserOnboardingState {
  onboardingCompleted: boolean;
  onboardingPhase: UserOnboardingPhase;
}

export interface UpdateUserOnboardingInput {
  onboardingCompleted?: boolean;
  onboardingPhase?: UserOnboardingPhase;
}

function normalizePhase(value: number | null | undefined): UserOnboardingPhase {
  if (value === 1 || value === 2) return value;
  return 0;
}

function mapOnboardingState(profile: {
  onboarding_completed?: boolean | null;
  onboarding_phase?: number | null;
} | null): UserOnboardingState {
  return {
    onboardingCompleted: profile?.onboarding_completed ?? false,
    onboardingPhase: normalizePhase(profile?.onboarding_phase),
  };
}

export async function getUserOnboardingState(
  userId: string
): Promise<UserOnboardingState> {
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("onboarding_completed, onboarding_phase")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return mapOnboardingState(data);
}

export async function updateUserOnboardingState(
  userId: string,
  input: UpdateUserOnboardingInput
): Promise<UserOnboardingState> {
  const supabase = createServiceRoleClient();
  const updates: {
    onboarding_completed?: boolean;
    onboarding_phase?: UserOnboardingPhase;
  } = {};

  if (input.onboardingCompleted !== undefined) {
    updates.onboarding_completed = input.onboardingCompleted;
  }

  if (input.onboardingPhase !== undefined) {
    updates.onboarding_phase = input.onboardingPhase;
  }

  const { error } = await supabase.from("profiles").upsert(
    {
      id: userId,
      ...updates,
    },
    { onConflict: "id" }
  );

  if (error) {
    throw new Error(error.message);
  }

  return getUserOnboardingState(userId);
}
