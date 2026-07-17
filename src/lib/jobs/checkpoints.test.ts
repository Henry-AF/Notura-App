import type { SupabaseClient } from "@supabase/supabase-js";
import { NonRetriableError } from "inngest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Database, Json } from "@/types/database";

const mocks = vi.hoisted(() => ({
  captureObservedError: vi.fn(),
  deleteObject: vi.fn(),
  getJsonObject: vi.fn(),
  listObjectKeys: vi.fn(),
  logStructured: vi.fn(),
  putJsonObject: vi.fn(),
}));

vi.mock("@/lib/observability", () => ({
  captureObservedError: mocks.captureObservedError,
  createTraceId: () => "trace-id",
  getErrorMessage: (error: unknown) =>
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : JSON.stringify(error),
  logStructured: mocks.logStructured,
}));

vi.mock("@/lib/r2", () => ({
  deleteObject: mocks.deleteObject,
  getJsonObject: mocks.getJsonObject,
  listObjectKeys: mocks.listObjectKeys,
  putJsonObject: mocks.putJsonObject,
}));

import {
  CHECKPOINT_PERSIST_MAX_ATTEMPTS,
  buildCheckpointFingerprint,
  classifyCheckpointStoreError,
  computeCheckpointBackoffDelayMs,
  purgeMeetingCheckpoints,
  withCheckpoint,
  type CheckpointContext,
} from "./checkpoints";

type SupabaseAdminClient = SupabaseClient<Database>;

interface StoredCheckpoint {
  status: string;
  payload: unknown;
  fingerprint: string | null;
  attempts: number;
}

function checkpointKey(meetingId: unknown, stepName: unknown): string {
  return `${String(meetingId)}::${String(stepName)}`;
}

function createCheckpointSupabaseFake(
  behavior: {
    loadError?: unknown;
    upsertFailures?: unknown[];
    deleteError?: unknown;
  } = {}
) {
  const store = new Map<string, StoredCheckpoint>();
  const upsertCalls: Array<Record<string, unknown>> = [];
  const upsertFailures = [...(behavior.upsertFailures ?? [])];

  const client = {
    from: vi.fn(() => ({
      select: vi.fn(() => {
        const filters: Record<string, unknown> = {};
        const builder = {
          eq: vi.fn((column: string, value: unknown) => {
            filters[column] = value;
            return builder;
          }),
          maybeSingle: vi.fn(() => {
            if (behavior.loadError) {
              return Promise.resolve({ data: null, error: behavior.loadError });
            }
            const row =
              store.get(checkpointKey(filters.meeting_id, filters.step_name)) ??
              null;
            return Promise.resolve({ data: row, error: null });
          }),
        };
        return builder;
      }),
      upsert: vi.fn((payload: Record<string, unknown>) => {
        upsertCalls.push(payload);
        const failure = upsertFailures.shift();
        if (failure) {
          return Promise.resolve({ error: failure });
        }
        store.set(checkpointKey(payload.meeting_id, payload.step_name), {
          status: String(payload.status),
          payload: payload.payload,
          fingerprint: (payload.fingerprint as string | null) ?? null,
          attempts: Number(payload.attempts),
        });
        return Promise.resolve({ error: null });
      }),
      delete: vi.fn(() => ({
        eq: vi.fn((column: string, value: unknown) => {
          if (behavior.deleteError) {
            return Promise.resolve({ error: behavior.deleteError });
          }
          expect(column).toBe("meeting_id");
          for (const key of [...store.keys()]) {
            if (key.startsWith(`${String(value)}::`)) {
              store.delete(key);
            }
          }
          return Promise.resolve({ error: null });
        }),
      })),
    })),
  };

  return {
    client: client as unknown as SupabaseAdminClient,
    store,
    upsertCalls,
  };
}

function createContext(
  supabase: SupabaseAdminClient,
  overrides: Partial<CheckpointContext> = {}
): CheckpointContext {
  return {
    supabase,
    meetingId: "meeting-1",
    jobId: "job-1",
    userId: "user-1",
    ...overrides,
  };
}

function seedCompletedCheckpoint(
  store: Map<string, StoredCheckpoint>,
  input: { stepName?: string; payload: unknown; fingerprint: string; attempts?: number }
) {
  store.set(checkpointKey("meeting-1", input.stepName ?? "step-a"), {
    status: "completed",
    payload: input.payload,
    fingerprint: input.fingerprint,
    attempts: input.attempts ?? 1,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getJsonObject.mockResolvedValue(null);
  mocks.putJsonObject.mockResolvedValue(undefined);
  mocks.deleteObject.mockResolvedValue(undefined);
  mocks.listObjectKeys.mockResolvedValue([]);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("withCheckpoint - checkpoint hits and misses", () => {
  it("returns the checkpointed payload without executing on a completed hit", async () => {
    const { client, store, upsertCalls } = createCheckpointSupabaseFake();
    seedCompletedCheckpoint(store, {
      payload: { value: "cached" },
      fingerprint: "fp-1",
      attempts: 2,
    });
    const execute = vi.fn(() => Promise.resolve({ value: "fresh" }));

    const result = await withCheckpoint({
      ...createContext(client),
      stepName: "step-a",
      fingerprint: "fp-1",
      execute,
    });

    expect(result).toEqual({ value: "cached" });
    expect(execute).not.toHaveBeenCalled();
    expect(upsertCalls).toHaveLength(0);
    expect(mocks.logStructured).toHaveBeenCalledWith(
      "info",
      expect.objectContaining({
        event: "inngest.checkpoint.checkpoint_hit",
        meetingId: "meeting-1",
        jobId: "job-1",
        step: "step-a",
        attempt: 2,
      })
    );
  });

  it("executes and persists on a miss, then serves the next call from the checkpoint", async () => {
    const { client, upsertCalls } = createCheckpointSupabaseFake();
    const execute = vi.fn(() => Promise.resolve({ value: "fresh" }));
    const input = {
      ...createContext(client),
      stepName: "step-a",
      fingerprint: "fp-1",
      execute,
    };

    const first = await withCheckpoint(input);
    const second = await withCheckpoint(input);

    expect(first).toEqual({ value: "fresh" });
    expect(second).toEqual({ value: "fresh" });
    expect(execute).toHaveBeenCalledTimes(1);
    expect(upsertCalls).toHaveLength(1);
    expect(upsertCalls[0]).toMatchObject({
      meeting_id: "meeting-1",
      job_id: "job-1",
      user_id: "user-1",
      step_name: "step-a",
      status: "completed",
      payload: { value: "fresh" },
      fingerprint: "fp-1",
      attempts: 1,
      error: null,
    });
  });
});

describe("withCheckpoint - fingerprint mismatches and load errors", () => {
  it("re-executes and overwrites when the fingerprint does not match", async () => {
    const { client, store, upsertCalls } = createCheckpointSupabaseFake();
    seedCompletedCheckpoint(store, {
      payload: { value: "stale" },
      fingerprint: "fp-old",
      attempts: 3,
    });
    const execute = vi.fn(() => Promise.resolve({ value: "fresh" }));

    const result = await withCheckpoint({
      ...createContext(client),
      stepName: "step-a",
      fingerprint: "fp-new",
      execute,
    });

    expect(result).toEqual({ value: "fresh" });
    expect(execute).toHaveBeenCalledTimes(1);
    expect(upsertCalls).toHaveLength(1);
    expect(upsertCalls[0]).toMatchObject({
      fingerprint: "fp-new",
      attempts: 4,
    });
    expect(mocks.logStructured).toHaveBeenCalledWith(
      "warn",
      expect.objectContaining({
        event: "inngest.checkpoint.invalid_fingerprint",
        step: "step-a",
      })
    );
  });

  it("throws on a transient load error without executing", async () => {
    const { client, upsertCalls } = createCheckpointSupabaseFake({
      loadError: { message: "fetch failed" },
    });
    const execute = vi.fn(() => Promise.resolve({ value: "fresh" }));

    await expect(
      withCheckpoint({
        ...createContext(client),
        stepName: "step-a",
        fingerprint: "fp-1",
        execute,
      })
    ).rejects.toThrow(/transient store error/);

    expect(execute).not.toHaveBeenCalled();
    expect(upsertCalls).toHaveLength(0);
  });

  it("fails fast on a permanent load error", async () => {
    const { client } = createCheckpointSupabaseFake({
      loadError: {
        message: 'relation "public.job_checkpoints" does not exist',
        code: "42P01",
      },
    });
    const execute = vi.fn(() => Promise.resolve({ value: "fresh" }));

    const error = await withCheckpoint({
      ...createContext(client),
      stepName: "step-a",
      fingerprint: "fp-1",
      execute,
    }).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(NonRetriableError);
    expect((error as Error).message).toMatch(/033_job_checkpoints/);
    expect(execute).not.toHaveBeenCalled();
  });
});

describe("withCheckpoint - persist retries and degradation", () => {
  it("retries transient persist failures with backoff and succeeds", async () => {
    vi.useFakeTimers();
    const { client, upsertCalls } = createCheckpointSupabaseFake({
      upsertFailures: [
        { message: "service unavailable", status: 503 },
        { message: "connection reset by peer" },
      ],
    });

    const promise = withCheckpoint({
      ...createContext(client),
      stepName: "step-a",
      fingerprint: "fp-1",
      execute: () => Promise.resolve({ value: "fresh" }),
    });
    await vi.advanceTimersByTimeAsync(10_000);
    const result = await promise;

    expect(result).toEqual({ value: "fresh" });
    expect(upsertCalls).toHaveLength(3);
    expect(mocks.logStructured).toHaveBeenCalledWith(
      "warn",
      expect.objectContaining({
        event: "inngest.checkpoint.persist_retry",
        step: "step-a",
      })
    );
    expect(mocks.logStructured).toHaveBeenCalledWith(
      "info",
      expect.objectContaining({
        event: "inngest.checkpoint.persisted",
        step: "step-a",
      })
    );
  });
});

describe("withCheckpoint - persist buffer exhaustion", () => {
  it("buffers the result to R2 when the Postgres persist buffer cannot be flushed", async () => {
    vi.useFakeTimers();
    const transientFailure = { message: "gateway timeout", status: 504 };
    const { client, upsertCalls } = createCheckpointSupabaseFake({
      upsertFailures: Array.from(
        { length: CHECKPOINT_PERSIST_MAX_ATTEMPTS },
        () => transientFailure
      ),
    });

    const promise = withCheckpoint({
      ...createContext(client),
      stepName: "step-a",
      fingerprint: "fp-1",
      execute: () => Promise.resolve({ value: "fresh" }),
    });
    await vi.advanceTimersByTimeAsync(30_000);
    const result = await promise;

    expect(result).toEqual({ value: "fresh" });
    expect(upsertCalls).toHaveLength(CHECKPOINT_PERSIST_MAX_ATTEMPTS);
    expect(mocks.putJsonObject).toHaveBeenCalledWith(
      "checkpoints/meeting-1/step-a.json",
      expect.objectContaining({
        payload: { value: "fresh" },
        fingerprint: "fp-1",
      })
    );
    expect(mocks.logStructured).toHaveBeenCalledWith(
      "error",
      expect.objectContaining({
        event: "inngest.checkpoint.persist_failed_buffered_r2",
        step: "step-a",
        errorMessage: expect.stringContaining("gateway timeout") as string,
      })
    );
    expect(mocks.captureObservedError).toHaveBeenCalledWith(
      transientFailure,
      expect.objectContaining({
        event: "inngest.checkpoint.persist_failed_buffered_r2",
      })
    );
  });

  it("fully degrades with a structured log when both Postgres and the R2 buffer are unreachable", async () => {
    vi.useFakeTimers();
    mocks.putJsonObject.mockRejectedValue(new Error("R2 unreachable"));
    const transientFailure = { message: "gateway timeout", status: 504 };
    const { client } = createCheckpointSupabaseFake({
      upsertFailures: Array.from(
        { length: CHECKPOINT_PERSIST_MAX_ATTEMPTS },
        () => transientFailure
      ),
    });

    const promise = withCheckpoint({
      ...createContext(client),
      stepName: "step-a",
      fingerprint: "fp-1",
      execute: () => Promise.resolve({ value: "fresh" }),
    });
    await vi.advanceTimersByTimeAsync(30_000);
    const result = await promise;

    expect(result).toEqual({ value: "fresh" });
    expect(mocks.logStructured).toHaveBeenCalledWith(
      "error",
      expect.objectContaining({
        event: "inngest.checkpoint.persist_failed_degraded",
        step: "step-a",
      })
    );
    expect(mocks.captureObservedError).toHaveBeenCalledWith(
      transientFailure,
      expect.objectContaining({
        event: "inngest.checkpoint.persist_failed_degraded",
      })
    );
  });
});

describe("withCheckpoint - R2 reconciliation", () => {
  it("reconciles a buffered R2 fallback into Postgres instead of re-executing", async () => {
    const { client, upsertCalls } = createCheckpointSupabaseFake();
    mocks.getJsonObject.mockResolvedValue({
      payload: { value: "buffered" },
      fingerprint: "fp-1",
      attempts: 1,
      savedAt: "2026-07-17T00:00:00.000Z",
    });
    const execute = vi.fn(() => Promise.resolve({ value: "fresh" }));

    const result = await withCheckpoint({
      ...createContext(client),
      stepName: "step-a",
      fingerprint: "fp-1",
      execute,
    });

    expect(result).toEqual({ value: "buffered" });
    expect(execute).not.toHaveBeenCalled();
    expect(upsertCalls).toHaveLength(1);
    expect(upsertCalls[0]).toMatchObject({
      step_name: "step-a",
      status: "completed",
      payload: { value: "buffered" },
      fingerprint: "fp-1",
    });
    expect(mocks.deleteObject).toHaveBeenCalledWith("checkpoints/meeting-1/step-a.json");
    expect(mocks.logStructured).toHaveBeenCalledWith(
      "info",
      expect.objectContaining({ event: "inngest.checkpoint.reconciled_from_r2" })
    );
  });

  it("serves the R2 fallback without re-executing even when Postgres is still down", async () => {
    const { client } = createCheckpointSupabaseFake({
      upsertFailures: [{ message: "service unavailable", status: 503 }],
    });
    mocks.getJsonObject.mockResolvedValue({
      payload: { value: "buffered" },
      fingerprint: "fp-1",
      attempts: 1,
      savedAt: "2026-07-17T00:00:00.000Z",
    });
    const execute = vi.fn(() => Promise.resolve({ value: "fresh" }));

    const result = await withCheckpoint({
      ...createContext(client),
      stepName: "step-a",
      fingerprint: "fp-1",
      execute,
    });

    expect(result).toEqual({ value: "buffered" });
    expect(execute).not.toHaveBeenCalled();
    expect(mocks.deleteObject).not.toHaveBeenCalled();
    expect(mocks.logStructured).toHaveBeenCalledWith(
      "warn",
      expect.objectContaining({ event: "inngest.checkpoint.reconciled_from_r2_pg_still_down" })
    );
  });
});

describe("withCheckpoint - R2 reconciliation edge cases", () => {
  it("ignores an R2 fallback whose fingerprint no longer matches and re-executes", async () => {
    const { client } = createCheckpointSupabaseFake();
    mocks.getJsonObject.mockResolvedValue({
      payload: { value: "stale" },
      fingerprint: "fp-old",
      attempts: 1,
      savedAt: "2026-07-17T00:00:00.000Z",
    });
    const execute = vi.fn(() => Promise.resolve({ value: "fresh" }));

    const result = await withCheckpoint({
      ...createContext(client),
      stepName: "step-a",
      fingerprint: "fp-new",
      execute,
    });

    expect(result).toEqual({ value: "fresh" });
    expect(execute).toHaveBeenCalledTimes(1);
  });

  it("reconciles from R2 when the Postgres read itself fails transiently", async () => {
    const { client, upsertCalls } = createCheckpointSupabaseFake({
      loadError: { message: "fetch failed" },
    });
    mocks.getJsonObject.mockResolvedValue({
      payload: { value: "buffered" },
      fingerprint: "fp-1",
      attempts: 1,
      savedAt: "2026-07-17T00:00:00.000Z",
    });
    const execute = vi.fn(() => Promise.resolve({ value: "fresh" }));

    const result = await withCheckpoint({
      ...createContext(client),
      stepName: "step-a",
      fingerprint: "fp-1",
      execute,
    });

    expect(result).toEqual({ value: "buffered" });
    expect(execute).not.toHaveBeenCalled();
    expect(upsertCalls).toHaveLength(1);
  });

  it("still throws on a transient Postgres read error when R2 has nothing usable", async () => {
    const { client } = createCheckpointSupabaseFake({
      loadError: { message: "fetch failed" },
    });
    const execute = vi.fn(() => Promise.resolve({ value: "fresh" }));

    await expect(
      withCheckpoint({
        ...createContext(client),
        stepName: "step-a",
        fingerprint: "fp-1",
        execute,
      })
    ).rejects.toThrow(/transient store error/);
    expect(execute).not.toHaveBeenCalled();
  });
});

describe("purgeMeetingCheckpoints - R2 fallback sweep", () => {
  it("deletes leftover R2 fallback objects for the meeting", async () => {
    const { client } = createCheckpointSupabaseFake();
    mocks.listObjectKeys.mockResolvedValue([
      "checkpoints/meeting-1/transcribe.json",
      "checkpoints/meeting-1/summarize-meeting.json",
    ]);

    await purgeMeetingCheckpoints(createContext(client));

    expect(mocks.listObjectKeys).toHaveBeenCalledWith("checkpoints/meeting-1/");
    expect(mocks.deleteObject).toHaveBeenCalledWith(
      "checkpoints/meeting-1/transcribe.json"
    );
    expect(mocks.deleteObject).toHaveBeenCalledWith(
      "checkpoints/meeting-1/summarize-meeting.json"
    );
  });
});

describe("withCheckpoint - permanent persist errors", () => {
  it("fails fast without retrying on a permanent persist error", async () => {
    const { client, upsertCalls } = createCheckpointSupabaseFake({
      upsertFailures: [{ message: "column does not exist", code: "42703" }],
    });

    const error = await withCheckpoint({
      ...createContext(client),
      stepName: "step-a",
      fingerprint: "fp-1",
      execute: () => Promise.resolve({ value: "fresh" }),
    }).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(NonRetriableError);
    expect((error as Error).message).toMatch(/permanent store error/);
    expect(upsertCalls).toHaveLength(1);
  });
});

describe("purgeMeetingCheckpoints", () => {
  it("deletes every checkpoint of the meeting and keeps other meetings", async () => {
    const { client, store } = createCheckpointSupabaseFake();
    seedCompletedCheckpoint(store, { payload: { a: 1 }, fingerprint: "fp" });
    store.set(checkpointKey("meeting-1", "step-b"), {
      status: "completed",
      payload: { b: 2 },
      fingerprint: "fp",
      attempts: 1,
    });
    store.set(checkpointKey("meeting-2", "step-a"), {
      status: "completed",
      payload: { c: 3 },
      fingerprint: "fp",
      attempts: 1,
    });

    await purgeMeetingCheckpoints(createContext(client));

    expect(store.has(checkpointKey("meeting-1", "step-a"))).toBe(false);
    expect(store.has(checkpointKey("meeting-1", "step-b"))).toBe(false);
    expect(store.has(checkpointKey("meeting-2", "step-a"))).toBe(true);
    expect(mocks.logStructured).toHaveBeenCalledWith(
      "info",
      expect.objectContaining({ event: "inngest.checkpoint.purged" })
    );
  });

  it("never throws when the delete fails", async () => {
    const deleteError = { message: "connection reset by peer" };
    const { client } = createCheckpointSupabaseFake({ deleteError });

    await expect(
      purgeMeetingCheckpoints(createContext(client))
    ).resolves.toBeUndefined();

    expect(mocks.logStructured).toHaveBeenCalledWith(
      "error",
      expect.objectContaining({ event: "inngest.checkpoint.purge_failed" })
    );
    expect(mocks.captureObservedError).toHaveBeenCalledWith(
      deleteError,
      expect.objectContaining({ event: "inngest.checkpoint.purge_failed" })
    );
  });
});

describe("classifyCheckpointStoreError", () => {
  it.each([
    [{ message: "service unavailable", status: 503 }, "transient"],
    [{ message: "timeout", status: 408 }, "transient"],
    [{ message: "rate limit", status: 429 }, "transient"],
    [{ message: "bad request", status: 400 }, "permanent"],
    [{ message: "not found", status: 404 }, "permanent"],
    [{ message: "PGRST205: table not found in schema cache", code: "PGRST205" }, "permanent"],
    [{ message: 'relation "job_checkpoints" does not exist', code: "42P01" }, "permanent"],
    [{ message: "too many connections", code: "53300" }, "transient"],
    [{ message: "connection terminated", code: "08006" }, "transient"],
    [new TypeError("fetch failed"), "transient"],
    [new Error("ECONNRESET"), "transient"],
    [new Error("totally unexpected"), "transient"],
  ] as const)("classifies %o as %s", (error, expected) => {
    expect(classifyCheckpointStoreError(error)).toBe(expected);
  });
});

describe("buildCheckpointFingerprint", () => {
  it("is stable for the same parts and changes when any part changes", () => {
    const base = buildCheckpointFingerprint(["transcript", "v1", 768]);
    expect(buildCheckpointFingerprint(["transcript", "v1", 768])).toBe(base);
    expect(buildCheckpointFingerprint(["transcript", "v2", 768])).not.toBe(base);
    expect(buildCheckpointFingerprint(["other", "v1", 768])).not.toBe(base);
    expect(buildCheckpointFingerprint(["transcript", "v1", 768, null])).not.toBe(base);
  });
});

describe("computeCheckpointBackoffDelayMs", () => {
  it("stays within the exponential bounds with full jitter", () => {
    for (let sample = 0; sample < 100; sample += 1) {
      expect(computeCheckpointBackoffDelayMs(0)).toBeLessThan(500);
      expect(computeCheckpointBackoffDelayMs(1)).toBeLessThan(1_000);
      expect(computeCheckpointBackoffDelayMs(2)).toBeLessThan(2_000);
      expect(computeCheckpointBackoffDelayMs(10)).toBeLessThan(8_000);
      expect(computeCheckpointBackoffDelayMs(2)).toBeGreaterThanOrEqual(0);
    }
  });
});

// Type-level sanity: payloads are stored as Json objects, never `any`.
const _payloadCheck: Json = { rows: [{ embedding: [0.1, 0.2] }] };
void _payloadCheck;
