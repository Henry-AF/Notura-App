export const FUNNEL_STEPS = [
  "problem",
  "profile",
  "frequency",
  "goals",
  "promise",
  "objections",
  "demo",
  "aha",
] as const;

export type FunnelStepId = (typeof FUNNEL_STEPS)[number];

export type ProblemId = "minutes" | "tasks" | "decisions" | "follow-up" | "memory" | "all";
export type ProfileId =
  | "manager"
  | "sales"
  | "operations"
  | "product"
  | "projects"
  | "admin"
  | "other";
export type MeetingFrequencyId = "1-3" | "4-7" | "8-15" | "15+";
export type GoalId =
  | "minutes"
  | "summary"
  | "decisions"
  | "tasks"
  | "owners"
  | "deadlines"
  | "search"
  | "ask";

export interface OnboardingState {
  currentStep: FunnelStepId;
  problem?: ProblemId;
  profile?: ProfileId;
  meetingFrequency?: MeetingFrequencyId;
  goals: GoalId[];
  /** Raw, normalized campaign slug (e.g. "tasks"). Unknown campaigns are kept for attribution. */
  campaign?: string;
  completed: boolean;
}

export interface Option<T extends string = string> {
  id: T;
  label: string;
}

export interface OnboardingContent {
  title: string;
  subtitle?: string;
  description?: string;
  eyebrow?: string;
  options?: Option[];
  cta?: string;
}
