import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("posthog-js", () => ({
  default: { capture: vi.fn(), identify: vi.fn() },
}));

import posthog from "posthog-js";
import { buildFunnelProperties, trackFunnelEvent, trackSignupCompleted } from "./analytics";
import { createInitialState } from "./engine";

const answered = {
  ...createInitialState("tasks"),
  problem: "tasks" as const,
  profile: "manager" as const,
  meetingFrequency: "8-15" as const,
  goals: ["tasks" as const],
};

beforeEach(() => vi.clearAllMocks());

describe("buildFunnelProperties", () => {
  it("carries the answers and the acquisition flow marker", () => {
    expect(buildFunnelProperties(answered)).toEqual({
      flow: "acquisition",
      problem: "tasks",
      profile: "manager",
      meetingFrequency: "8-15",
      goals: ["tasks"],
      campaign: "tasks",
    });
  });
});

describe("trackFunnelEvent", () => {
  it("captures the event with the state properties and extras", () => {
    trackFunnelEvent("onboarding_promise_viewed", answered, { index: 1 });

    expect(posthog.capture).toHaveBeenCalledWith(
      "onboarding_promise_viewed",
      expect.objectContaining({ flow: "acquisition", problem: "tasks", index: 1 })
    );
  });

  it("lets explicit extras override the state (answer not yet in state)", () => {
    trackFunnelEvent("onboarding_problem_selected", createInitialState(), { problem: "minutes" });

    expect(posthog.capture).toHaveBeenCalledWith(
      "onboarding_problem_selected",
      expect.objectContaining({ problem: "minutes" })
    );
  });
});

describe("trackSignupCompleted", () => {
  it("identifies the user with the funnel answers and captures signup_completed", () => {
    trackSignupCompleted("user-1", answered, "email");

    expect(posthog.identify).toHaveBeenCalledWith(
      "user-1",
      expect.objectContaining({ problem: "tasks" })
    );
    expect(posthog.capture).toHaveBeenCalledWith(
      "signup_completed",
      expect.objectContaining({ method: "email", campaign: "tasks" })
    );
  });

  it("still tracks signups that never went through the funnel", () => {
    trackSignupCompleted("user-2", null, "google");

    expect(posthog.capture).toHaveBeenCalledWith(
      "signup_completed",
      expect.objectContaining({ flow: "acquisition", method: "google" })
    );
  });
});
