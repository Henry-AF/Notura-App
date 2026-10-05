import posthog from "posthog-js";
import type { OnboardingState } from "./types";

export type FunnelEvent =
  | "onboarding_started"
  | "onboarding_problem_selected"
  | "onboarding_profile_selected"
  | "onboarding_frequency_selected"
  | "onboarding_goal_selected"
  | "onboarding_promise_viewed"
  | "onboarding_objection_viewed"
  | "demo_meeting_opened"
  | "demo_meeting_result_viewed"
  | "aha_moment_reached"
  | "signup_started"
  | "signup_completed"
  | "first_meeting_started"
  | "first_meeting_uploaded"
  | "first_meeting_completed"
  | "onboarding_completed";

export type FunnelEventProperties = Record<string, string | number | boolean | string[] | undefined>;

/** Answers that travel with every funnel event so each step can be segmented. */
export function buildFunnelProperties(
  state: Pick<OnboardingState, "problem" | "profile" | "meetingFrequency" | "goals" | "campaign">
): FunnelEventProperties {
  return {
    flow: "acquisition",
    problem: state.problem,
    profile: state.profile,
    meetingFrequency: state.meetingFrequency,
    goals: state.goals,
    campaign: state.campaign,
  };
}

export function trackFunnelEvent(
  event: FunnelEvent,
  state: OnboardingState,
  extra: FunnelEventProperties = {}
): void {
  posthog.capture(event, { ...buildFunnelProperties(state), ...extra });
}

/** Links the anonymous funnel session to the new account and stores the answers as person properties. */
export function trackSignupCompleted(
  userId: string,
  state: OnboardingState | null,
  method: "email" | "google"
): void {
  const properties = state ? buildFunnelProperties(state) : { flow: "acquisition" };
  posthog.identify(userId, properties);
  posthog.capture("signup_completed", { ...properties, method });
}
