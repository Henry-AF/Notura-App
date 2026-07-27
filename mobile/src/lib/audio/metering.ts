// Pure helpers for turning expo-audio's raw dB metering readings into a
// smoothed [0, 1] amplitude the recording UI can animate against.
// No React or native imports here on purpose — keeps this trivially
// unit-testable and reusable outside of any specific component.

const DEFAULT_MIN_DB = -60;
const MAX_DB = 0;

// expo-audio reports metering in dBFS, roughly -160 (silence) to 0 (peak).
// Voices rarely go below about -60dB, so that is used as the practical
// "silence" floor by default — quieter readings still clamp to 0.
export function normalizeMeteringDb(db: number | null, options?: { minDb?: number }): number {
  if (db === null) return 0;

  const minDb = options?.minDb ?? DEFAULT_MIN_DB;
  const clampedDb = Math.min(MAX_DB, Math.max(minDb, db));
  return (clampedDb - minDb) / (MAX_DB - minDb);
}

// Exponential smoothing between animation frames so bar heights ease
// toward the latest reading instead of jumping. `smoothing` of 1 applies
// `next` instantly; `smoothing` of 0 leaves `previous` unchanged.
export function smoothAmplitude(previous: number, next: number, smoothing: number): number {
  return previous * (1 - smoothing) + next * smoothing;
}
