import type { Plan } from "@/types/database";

/** Days after a dismissed trial offer before the user is offered the trial again. */
export const TRIAL_OFFER_REPROMPT_DAYS = 7;

export interface TrialOfferEligibilityInput {
  plan: Plan;
  hasUsedTrial: boolean;
  trialOfferDismissedAt: string | null;
  now?: Date;
}

function isRepromptDue(dismissedAt: string, now: Date): boolean {
  const dismissedTime = new Date(dismissedAt).getTime();
  const elapsedMs = now.getTime() - dismissedTime;
  const repromptMs = TRIAL_OFFER_REPROMPT_DAYS * 24 * 60 * 60 * 1000;
  return elapsedMs > repromptMs;
}

export function resolveTrialOfferEligibility(
  input: TrialOfferEligibilityInput
): boolean {
  if (input.plan !== "free" || input.hasUsedTrial) return false;
  if (!input.trialOfferDismissedAt) return true;

  const now = input.now ?? new Date();
  return isRepromptDue(input.trialOfferDismissedAt, now);
}
