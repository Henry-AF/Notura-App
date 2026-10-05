import { afterEach, describe, expect, it, vi } from "vitest";
import { createInitialState } from "@/lib/onboarding-funnel/engine";
import { buildSignupHref, hasCompletedFunnel, hydrateFunnel, persistFunnel } from "./start-api";

function stubStorage(store: Record<string, string> = {}) {
  vi.stubGlobal("window", {
    localStorage: {
      getItem: (key: string) => store[key] ?? null,
      setItem: (key: string, value: string) => {
        store[key] = value;
      },
    },
  });
}

afterEach(() => vi.unstubAllGlobals());

describe("hydrateFunnel", () => {
  it("starts fresh with the normalized campaign", () => {
    stubStorage();
    const { state, resumed } = hydrateFunnel("Tasks");

    expect(resumed).toBe(false);
    expect(state.campaign).toBe("tasks");
    expect(state.currentStep).toBe("problem");
  });

  it("resumes a stored funnel and keeps its campaign when the URL has none", () => {
    stubStorage();
    persistFunnel({ ...createInitialState("sales"), currentStep: "profile", problem: "tasks" });

    const { state, resumed } = hydrateFunnel(null);

    expect(resumed).toBe(true);
    expect(state).toMatchObject({ currentStep: "profile", problem: "tasks", campaign: "sales" });
  });

  it("lets a new campaign from the URL win over the stored one", () => {
    stubStorage();
    persistFunnel(createInitialState("sales"));

    expect(hydrateFunnel("manager").state.campaign).toBe("manager");
  });
});

describe("buildSignupHref", () => {
  it("marks the signup as coming from the funnel", () => {
    expect(buildSignupHref(createInitialState())).toBe("/signup?from=start");
  });

  it("forwards the campaign", () => {
    expect(buildSignupHref(createInitialState("tasks"))).toBe("/signup?from=start&campaign=tasks");
  });
});

describe("hasCompletedFunnel", () => {
  it("is true only after the funnel is completed", () => {
    stubStorage();
    expect(hasCompletedFunnel()).toBe(false);

    persistFunnel({ ...createInitialState(), completed: true });
    expect(hasCompletedFunnel()).toBe(true);
  });
});
