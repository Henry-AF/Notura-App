import { createInitialState, normalizeCampaign } from "@/lib/onboarding-funnel/engine";
import { loadFunnelState, saveFunnelState } from "@/lib/onboarding-funnel/storage";
import type { OnboardingState } from "@/lib/onboarding-funnel/types";

export interface HydratedFunnel {
  state: OnboardingState;
  resumed: boolean;
}

/**
 * Builds the initial funnel state. A campaign in the URL always wins over the stored one
 * (the user just clicked a different ad); everything else is resumed from storage.
 */
export function hydrateFunnel(campaignParam: string | null): HydratedFunnel {
  const campaign = normalizeCampaign(campaignParam);
  const stored = loadFunnelState();

  if (!stored) return { state: createInitialState(campaign), resumed: false };

  const nextCampaign = campaign ?? stored.campaign;
  return { state: { ...stored, campaign: nextCampaign }, resumed: true };
}

export function persistFunnel(state: OnboardingState): void {
  saveFunnelState(state);
}

/** Signup is the existing page; `from=start` makes it show the "save your experience" copy. */
export function buildSignupHref(state: OnboardingState): string {
  const params = new URLSearchParams({ from: "start" });
  if (state.campaign) params.set("campaign", state.campaign);
  return `/signup?${params.toString()}`;
}

/** True when the visitor reached the Aha Moment in this browser (used after signup). */
export function hasCompletedFunnel(): boolean {
  return loadFunnelState()?.completed === true;
}
