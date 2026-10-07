import {
  FUNNEL_STEPS,
  type FunnelStepId,
  type GoalId,
  type MeetingFrequencyId,
  type OnboardingState,
  type ProblemId,
  type ProfileId,
} from "./types";

export type OnboardingAction =
  | { type: "problemSelected"; value: ProblemId }
  | { type: "profileSelected"; value: ProfileId }
  | { type: "frequencySelected"; value: MeetingFrequencyId }
  | { type: "goalToggled"; value: GoalId }
  | { type: "next" }
  | { type: "back" }
  | { type: "completed" }
  | { type: "restored"; state: OnboardingState };

const CAMPAIGN_PATTERN = /^[a-z0-9][a-z0-9_-]{0,39}$/;

export function createInitialState(campaign?: string): OnboardingState {
  return { currentStep: "problem", goals: [], campaign, completed: false };
}

/** Accepts only short slugs so a campaign value can never carry arbitrary content. */
export function normalizeCampaign(raw: string | null): string | undefined {
  if (!raw) return undefined;
  const slug = raw.trim().toLowerCase();
  return CAMPAIGN_PATTERN.test(slug) ? slug : undefined;
}

export function getStepIndex(step: FunnelStepId): number {
  return FUNNEL_STEPS.indexOf(step);
}

function shiftStep(step: FunnelStepId, delta: 1 | -1): FunnelStepId {
  const target = getStepIndex(step) + delta;
  const clamped = Math.min(Math.max(target, 0), FUNNEL_STEPS.length - 1);
  return FUNNEL_STEPS[clamped];
}

/** The demo is a transition screen, so going back from the result skips it. */
function previousStep(step: FunnelStepId): FunnelStepId {
  const previous = shiftStep(step, -1);
  return previous === "demo" ? "objections" : previous;
}

export function canGoBack(step: FunnelStepId): boolean {
  return step !== "problem" && step !== "demo";
}

/** Progress (0–100) across the whole funnel; the result screen is always 100. */
export function getProgress(step: FunnelStepId): number {
  return Math.round(((getStepIndex(step) + 1) / FUNNEL_STEPS.length) * 100);
}

function toggleGoal(goals: GoalId[], goal: GoalId): GoalId[] {
  return goals.includes(goal) ? goals.filter((item) => item !== goal) : [...goals, goal];
}

export function onboardingReducer(
  state: OnboardingState,
  action: OnboardingAction
): OnboardingState {
  switch (action.type) {
    case "problemSelected":
      return { ...state, problem: action.value };
    case "profileSelected":
      return { ...state, profile: action.value };
    case "frequencySelected":
      return { ...state, meetingFrequency: action.value };
    case "goalToggled":
      return { ...state, goals: toggleGoal(state.goals, action.value) };
    case "next":
      return { ...state, currentStep: shiftStep(state.currentStep, 1) };
    case "back":
      return { ...state, currentStep: previousStep(state.currentStep) };
    case "completed":
      return { ...state, completed: true };
    case "restored":
      return action.state;
  }
}
