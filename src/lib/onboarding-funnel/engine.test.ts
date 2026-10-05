import { describe, expect, it } from "vitest";
import {
  canGoBack,
  createInitialState,
  getProgress,
  normalizeCampaign,
  onboardingReducer,
} from "./engine";

describe("normalizeCampaign", () => {
  it("lowercases and accepts short slugs", () => {
    expect(normalizeCampaign(" Meeting-Minutes ")).toBe("meeting-minutes");
  });

  it("rejects empty, long or unsafe values", () => {
    expect(normalizeCampaign(null)).toBeUndefined();
    expect(normalizeCampaign("")).toBeUndefined();
    expect(normalizeCampaign("<script>")).toBeUndefined();
    expect(normalizeCampaign("a".repeat(41))).toBeUndefined();
  });
});

describe("onboardingReducer", () => {
  it("stores single answers", () => {
    let state = createInitialState();
    state = onboardingReducer(state, { type: "problemSelected", value: "tasks" });
    state = onboardingReducer(state, { type: "profileSelected", value: "manager" });
    state = onboardingReducer(state, { type: "frequencySelected", value: "8-15" });

    expect(state).toMatchObject({ problem: "tasks", profile: "manager", meetingFrequency: "8-15" });
  });

  it("toggles goals on and off", () => {
    let state = createInitialState();
    state = onboardingReducer(state, { type: "goalToggled", value: "tasks" });
    state = onboardingReducer(state, { type: "goalToggled", value: "decisions" });
    state = onboardingReducer(state, { type: "goalToggled", value: "tasks" });

    expect(state.goals).toEqual(["decisions"]);
  });

  it("walks forward through the funnel and stops at the last step", () => {
    let state = createInitialState();
    for (let i = 0; i < 12; i += 1) state = onboardingReducer(state, { type: "next" });

    expect(state.currentStep).toBe("aha");
  });

  it("goes back one step and skips the demo transition", () => {
    const atFrequency = { ...createInitialState(), currentStep: "frequency" as const };
    expect(onboardingReducer(atFrequency, { type: "back" }).currentStep).toBe("profile");

    const atAha = { ...createInitialState(), currentStep: "aha" as const };
    expect(onboardingReducer(atAha, { type: "back" }).currentStep).toBe("objections");
  });

  it("marks the funnel as completed", () => {
    const state = onboardingReducer(createInitialState(), { type: "completed" });
    expect(state.completed).toBe(true);
  });
});

describe("navigation helpers", () => {
  it("only allows going back where it makes sense", () => {
    expect(canGoBack("problem")).toBe(false);
    expect(canGoBack("demo")).toBe(false);
    expect(canGoBack("profile")).toBe(true);
    expect(canGoBack("aha")).toBe(true);
  });

  it("reports progress from first to last step", () => {
    expect(getProgress("problem")).toBeLessThan(getProgress("promise"));
    expect(getProgress("aha")).toBe(100);
  });
});
