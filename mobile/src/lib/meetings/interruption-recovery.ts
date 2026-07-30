// NOT-138: expo-audio doesn't expose an interruption begin/end event in its
// public JS API, so `record.tsx` infers an interruption from
// `phase === 'recording'` while `isRecording` has flipped to `false` (screen
// lock, backgrounding, or — on iOS — a phone call). This module is the pure
// retry/backoff decision logic behind that inference, kept independent of
// React and `expo-audio` so it's testable without a device or a recorder
// instance.
//
// Acceptance (NOT-138): during a call, no app can record — that's a physical
// OS limit, not a bug. The scheduler's job is only to retry `recorder.record()`
// after the interruption ends, not to capture audio during it.

const DEFAULT_DELAYS_MS = [500, 1000, 2000, 4000, 8000];

export interface AutoResumeScheduler {
  /** Whether enough time has passed since the last attempt (or since start) to try again. */
  shouldAttempt(now: number): boolean;
  /** Records that an attempt was made at `now`. */
  recordAttempt(now: number): void;
  /** Resets the schedule — call once recording is confirmed active again. */
  reset(): void;
  /** True once every configured delay has been used up without recovering. */
  hasGivenUp(): boolean;
  readonly attemptCount: number;
}

export function createAutoResumeScheduler(
  delaysMs: readonly number[] = DEFAULT_DELAYS_MS
): AutoResumeScheduler {
  let attemptCount = 0;
  let lastAttemptAt: number | null = null;

  return {
    shouldAttempt(now) {
      if (attemptCount >= delaysMs.length) return false;
      if (lastAttemptAt === null) return true;
      return now - lastAttemptAt >= delaysMs[attemptCount - 1];
    },
    recordAttempt(now) {
      lastAttemptAt = now;
      attemptCount += 1;
    },
    reset() {
      attemptCount = 0;
      lastAttemptAt = null;
    },
    hasGivenUp() {
      return attemptCount >= delaysMs.length;
    },
    get attemptCount() {
      return attemptCount;
    },
  };
}
