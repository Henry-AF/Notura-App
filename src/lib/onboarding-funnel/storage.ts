import { FUNNEL_STEPS, type OnboardingState } from "./types";

const STORAGE_KEY = "notura-funnel-state";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/** Validates untrusted JSON from storage; returns null when the shape is not a funnel state. */
export function parseStoredState(raw: string): OnboardingState | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!isRecord(parsed)) return null;
  const step = parsed.currentStep;
  const stepIsValid = FUNNEL_STEPS.some((candidate) => candidate === step);
  if (!stepIsValid || !Array.isArray(parsed.goals) || typeof parsed.completed !== "boolean") {
    return null;
  }
  return parsed as unknown as OnboardingState;
}

/** Storage can be unavailable (private mode, blocked cookies): the funnel then simply runs in memory. */
export function loadFunnelState(): OnboardingState | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? parseStoredState(raw) : null;
  } catch {
    return null;
  }
}

export function saveFunnelState(state: OnboardingState): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Persistence is best-effort; the in-memory state keeps the flow working.
  }
}

export function clearFunnelState(): void {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Nothing to clear when storage is unavailable.
  }
}
