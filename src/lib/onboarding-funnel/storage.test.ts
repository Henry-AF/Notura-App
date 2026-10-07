import { afterEach, describe, expect, it, vi } from "vitest";
import { createInitialState } from "./engine";
import { loadFunnelState, parseStoredState, saveFunnelState } from "./storage";

function stubStorage(store: Record<string, string>) {
  vi.stubGlobal("window", {
    localStorage: {
      getItem: (key: string) => store[key] ?? null,
      setItem: (key: string, value: string) => {
        store[key] = value;
      },
      removeItem: (key: string) => {
        delete store[key];
      },
    },
  });
}

afterEach(() => vi.unstubAllGlobals());

describe("parseStoredState", () => {
  it("accepts a valid state", () => {
    const state = { ...createInitialState("tasks"), problem: "tasks" as const };
    expect(parseStoredState(JSON.stringify(state))).toEqual(state);
  });

  it.each([
    ["invalid json", "{nope"],
    ["not an object", "42"],
    ["unknown step", JSON.stringify({ currentStep: "x", goals: [], completed: false })],
    ["goals not an array", JSON.stringify({ currentStep: "problem", goals: 1, completed: false })],
    ["completed missing", JSON.stringify({ currentStep: "problem", goals: [] })],
  ])("rejects %s", (_label, raw) => {
    expect(parseStoredState(raw)).toBeNull();
  });
});

describe("save / load", () => {
  it("round-trips the state through localStorage", () => {
    stubStorage({});
    const state = { ...createInitialState(), profile: "manager" as const, goals: ["tasks" as const] };

    saveFunnelState(state);

    expect(loadFunnelState()).toEqual(state);
  });

  it("returns null when nothing is stored", () => {
    stubStorage({});
    expect(loadFunnelState()).toBeNull();
  });

  it("returns null when storage throws", () => {
    vi.stubGlobal("window", {
      localStorage: {
        getItem: () => {
          throw new Error("blocked");
        },
      },
    });
    expect(loadFunnelState()).toBeNull();
  });
});
