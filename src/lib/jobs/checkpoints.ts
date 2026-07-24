// ─────────────────────────────────────────────────────────────────────────────
// Persistent per-step checkpoints for the process-meeting job (NOT-69).
//
// A checkpoint stores the expensive external output of a pipeline step
// (AssemblyAI transcript, Gemini embeddings/summary) keyed by
// (meeting_id, step_name), so a retry resumes from the point of failure
// instead of re-calling providers.
//
// Design notes:
// - Scope is meeting_id (not job_id): every run creates a new `jobs` row, so
//   job-scoped checkpoints would never be found by a manual retry. `job_id`
//   is kept for traceability only.
// - withCheckpoint separates `execute` (expensive external call) from
//   materialization (idempotent Postgres writes, done by the caller on every
//   attempt). If Postgres fails while materializing, the next attempt replays
//   from the checkpoint without re-calling the provider.
// - Persist failures: transient store errors are retried with exponential
//   backoff and jitter. If the buffer still cannot be flushed, the result is
//   buffered in R2 at checkpoints/{meetingId}/{stepName}.json instead of
//   being lost. The next attempt reconciles: it reads the R2 fallback, tries
//   to write it into Postgres (best effort, single try), and either way
//   serves the buffered payload instead of re-running `execute`. Postgres
//   always wins when it already has a completed row with a matching
//   fingerprint — R2 is only consulted on a miss or a transient read error,
//   never on the happy path. The R2 object is deleted as soon as Postgres
//   has the row. Permanent store errors fail fast (no R2 fallback: retrying
//   a permanent error, e.g. a schema mismatch, never helps).
// ─────────────────────────────────────────────────────────────────────────────

import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { toNonRetriableJobError } from "@/lib/jobs/meeting-queue-guardrails";
import {
  captureObservedError,
  createTraceId,
  getErrorMessage,
  logStructured,
} from "@/lib/observability";
import { deleteObject, getJsonObject, listObjectKeys, putJsonObject } from "@/lib/r2";
import type { Database, Json } from "@/types/database";

type SupabaseAdminClient = SupabaseClient<Database>;

export interface CheckpointContext {
  supabase: SupabaseAdminClient;
  meetingId: string;
  jobId: string | null;
  userId: string;
}

export interface WithCheckpointInput<T> extends CheckpointContext {
  stepName: string;
  fingerprint: string;
  execute: () => Promise<T>;
}

export type CheckpointStoreErrorKind = "transient" | "permanent";

export const CHECKPOINT_PERSIST_MAX_ATTEMPTS = 4;
const CHECKPOINT_PERSIST_BASE_DELAY_MS = 500;
const CHECKPOINT_PERSIST_MAX_DELAY_MS = 8_000;
const CHECKPOINT_LOG_ROUTE = "inngest/process-meeting";

const CHECKPOINT_TABLE = "job_checkpoints";
const CHECKPOINT_CONFLICT_TARGET = "meeting_id,step_name";

interface CheckpointSnapshot {
  status: string;
  payload: Json | null;
  fingerprint: string | null;
  attempts: number;
}

interface CheckpointFallbackRecord {
  payload: Json;
  fingerprint: string;
  attempts: number;
  savedAt: string;
}

type CheckpointOutcome =
  | "checkpoint_hit"
  | "executed"
  | "persisted"
  | "persist_retry"
  | "persist_failed_buffered_r2"
  | "persist_failed_degraded"
  | "invalid_fingerprint"
  | "reconciled_from_r2"
  | "reconciled_from_r2_pg_still_down"
  | "purged"
  | "purge_failed";

// ── Error classification ─────────────────────────────────────────────────────

const TRANSIENT_STATUS_CODES = new Set([408, 409, 425, 429, 500, 502, 503, 504]);
const PERMANENT_STATUS_CODES = new Set([400, 401, 403, 404, 410, 413, 422]);

// Postgres SQLSTATE classes raised through PostgREST that usually recover.
const TRANSIENT_SQLSTATE_PREFIXES = ["08", "53", "55", "57"];

const TRANSIENT_MESSAGE_PATTERNS = [
  /fetch failed/i,
  /network/i,
  /timeout/i,
  /timed out/i,
  /econnreset/i,
  /eai_again/i,
  /enotfound/i,
  /socket/i,
  /temporarily unavailable/i,
  /service unavailable/i,
  /connection/i,
  /rate limit/i,
];

const PERMANENT_MESSAGE_PATTERNS = [
  /invalid/i,
  /malformed/i,
  /violat/i,
  /constraint/i,
  /does not exist/i,
  /undefined table/i,
  /schema cache/i,
  /permission denied/i,
  /unauthorized/i,
  /forbidden/i,
];

function readNumericCandidate(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.trunc(value);
  }
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value.trim());
    if (Number.isFinite(parsed)) return Math.trunc(parsed);
  }
  return null;
}

function extractHttpStatus(error: Record<string, unknown>): number | null {
  const direct =
    readNumericCandidate(error.status) ?? readNumericCandidate(error.statusCode);
  if (direct !== null) return direct;

  const response = error.response;
  if (response && typeof response === "object") {
    const record = response as Record<string, unknown>;
    return (
      readNumericCandidate(record.status) ??
      readNumericCandidate(record.statusCode)
    );
  }
  return null;
}

function extractErrorCode(error: Record<string, unknown>): string | null {
  const code = error.code;
  if (typeof code === "string" && code.trim()) return code.trim();
  return null;
}

function classifyByHttpStatus(
  status: number | null
): CheckpointStoreErrorKind | null {
  if (status === null) return null;
  if (TRANSIENT_STATUS_CODES.has(status)) return "transient";
  if (PERMANENT_STATUS_CODES.has(status)) return "permanent";
  return null;
}

function classifyByErrorCode(code: string | null): CheckpointStoreErrorKind | null {
  if (!code) return null;
  // PGRST1xx/2xx/3xx: PostgREST API-level errors (schema cache, auth, bad
  // request) — retrying never helps.
  if (/^PGRST\d+$/i.test(code)) return "permanent";
  if (TRANSIENT_SQLSTATE_PREFIXES.some((prefix) => code.startsWith(prefix))) {
    return "transient";
  }
  // Any other SQLSTATE-shaped code (22xxx, 23xxx, 42xxx, ...) is permanent.
  if (/^\d{2}[0-9A-Z]{3}$/i.test(code)) return "permanent";
  return null;
}

function classifyByMessage(message: string): CheckpointStoreErrorKind {
  if (TRANSIENT_MESSAGE_PATTERNS.some((pattern) => pattern.test(message))) {
    return "transient";
  }
  if (PERMANENT_MESSAGE_PATTERNS.some((pattern) => pattern.test(message))) {
    return "permanent";
  }
  // Unknown shapes default to transient, mirroring meeting-queue-guardrails.
  return "transient";
}

/**
 * Classifies a checkpoint store (PostgREST/Postgres/network) failure.
 * Transient failures are worth retrying with backoff; permanent ones are not.
 */
export function classifyCheckpointStoreError(
  error: unknown
): CheckpointStoreErrorKind {
  const record =
    error && typeof error === "object"
      ? (error as Record<string, unknown>)
      : null;

  if (record) {
    const byStatus = classifyByHttpStatus(extractHttpStatus(record));
    if (byStatus) return byStatus;

    const byCode = classifyByErrorCode(extractErrorCode(record));
    if (byCode) return byCode;
  }

  return classifyByMessage(getErrorMessage(error));
}

// ── Small utilities ──────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Full-jitter exponential backoff: random in [0, min(base * 2^i, cap)). */
export function computeCheckpointBackoffDelayMs(retryIndex: number): number {
  const exponential = Math.min(
    CHECKPOINT_PERSIST_BASE_DELAY_MS * 2 ** retryIndex,
    CHECKPOINT_PERSIST_MAX_DELAY_MS
  );
  return Math.floor(Math.random() * exponential);
}

/** Stable fingerprint of the inputs that make a checkpoint payload valid. */
export function buildCheckpointFingerprint(
  parts: ReadonlyArray<string | number | null | undefined>
): string {
  const serialized = parts
    .map((part) => (part === null || part === undefined ? "" : String(part)))
    .join("::");
  return createHash("sha256").update(serialized).digest("hex");
}

function logCheckpointEvent(input: {
  level: "info" | "warn" | "error";
  outcome: CheckpointOutcome;
  stepName: string;
  context: CheckpointContext;
  startedAt: number;
  attempt?: number;
  error?: unknown;
}) {
  logStructured(input.level, {
    event: `inngest.checkpoint.${input.outcome}`,
    requestId: createTraceId(),
    route: CHECKPOINT_LOG_ROUTE,
    durationMs: Date.now() - input.startedAt,
    status: input.outcome,
    userId: input.context.userId,
    meetingId: input.context.meetingId,
    jobId: input.context.jobId ?? undefined,
    step: input.stepName,
    ...(input.attempt !== undefined ? { attempt: input.attempt } : {}),
    ...(input.error !== undefined
      ? { errorMessage: getErrorMessage(input.error) }
      : {}),
  });
}

function captureCheckpointError(input: {
  error: unknown;
  outcome: CheckpointOutcome;
  stepName: string;
  context: CheckpointContext;
  startedAt: number;
}) {
  captureObservedError(input.error, {
    event: `inngest.checkpoint.${input.outcome}`,
    requestId: createTraceId(),
    route: CHECKPOINT_LOG_ROUTE,
    durationMs: Date.now() - input.startedAt,
    status: input.outcome,
    userId: input.context.userId,
    extra: {
      meetingId: input.context.meetingId,
      jobId: input.context.jobId,
      step: input.stepName,
    },
  });
}

interface CheckpointQueryResult<T> {
  data: T | null;
  error: unknown;
}

/** Normalizes supabase-js results: PostgREST may also throw on network errors. */
async function runCheckpointQuery<T>(
  query: () => Promise<CheckpointQueryResult<T>>
): Promise<CheckpointQueryResult<T>> {
  try {
    const result = await query();
    return { data: result.data ?? null, error: result.error ?? null };
  } catch (error) {
    return { data: null, error };
  }
}

// ── R2 fallback (used when Postgres is unreachable) ─────────────────────────

function buildCheckpointFallbackKey(meetingId: string, stepName: string): string {
  return `checkpoints/${meetingId}/${stepName}.json`;
}

async function readCheckpointFallback(
  meetingId: string,
  stepName: string
): Promise<CheckpointFallbackRecord | null> {
  try {
    return await getJsonObject<CheckpointFallbackRecord>(
      buildCheckpointFallbackKey(meetingId, stepName)
    );
  } catch {
    // R2 is a best-effort safety net, not a second source of truth: if it is
    // also unreachable, the caller falls back to its normal miss/error path.
    return null;
  }
}

async function writeCheckpointFallback(
  meetingId: string,
  stepName: string,
  record: CheckpointFallbackRecord
): Promise<boolean> {
  try {
    await putJsonObject(buildCheckpointFallbackKey(meetingId, stepName), record);
    return true;
  } catch {
    return false;
  }
}

async function deleteCheckpointFallback(
  meetingId: string,
  stepName: string
): Promise<void> {
  try {
    await deleteObject(buildCheckpointFallbackKey(meetingId, stepName));
  } catch {
    // Best-effort: a leftover fallback object is harmless — the next hit on
    // this step (from Postgres) is never overridden by a stale R2 object.
  }
}

/** Single-attempt reconciliation write: no backoff loop, the R2 object stays as a buffer if this fails too. */
async function tryPersistFallbackToPostgres(
  context: CheckpointContext,
  stepName: string,
  fallback: CheckpointFallbackRecord
): Promise<boolean> {
  const { error } = await runCheckpointQuery(async () =>
    await context.supabase.from(CHECKPOINT_TABLE).upsert(
      {
        meeting_id: context.meetingId,
        job_id: context.jobId,
        user_id: context.userId,
        step_name: stepName,
        status: "completed",
        payload: fallback.payload,
        fingerprint: fallback.fingerprint,
        attempts: fallback.attempts,
        error: null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: CHECKPOINT_CONFLICT_TARGET }
    )
  );

  if (error) return false;

  await deleteCheckpointFallback(context.meetingId, stepName);
  return true;
}

/**
 * Reads the R2 fallback for `stepName` and, when its fingerprint matches,
 * reconciles it into a checkpoint snapshot — attempting a best-effort write
 * back to Postgres along the way. Returns null when there is nothing usable
 * in R2 (never executes the caller's `execute`).
 */
async function reconcileFromFallback(
  context: CheckpointContext,
  stepName: string,
  fingerprint: string,
  startedAt: number
): Promise<CheckpointSnapshot | null> {
  const fallback = await readCheckpointFallback(context.meetingId, stepName);
  if (!fallback || fallback.fingerprint !== fingerprint) return null;

  const persisted = await tryPersistFallbackToPostgres(context, stepName, fallback);

  logCheckpointEvent({
    level: persisted ? "info" : "warn",
    outcome: persisted ? "reconciled_from_r2" : "reconciled_from_r2_pg_still_down",
    stepName,
    context,
    startedAt,
    attempt: fallback.attempts,
  });

  return {
    status: "completed",
    payload: fallback.payload,
    fingerprint: fallback.fingerprint,
    attempts: fallback.attempts,
  };
}

// ── Load / persist ───────────────────────────────────────────────────────────

async function loadCheckpoint(
  context: CheckpointContext,
  stepName: string,
  fingerprint: string,
  startedAt: number
): Promise<CheckpointSnapshot | null> {
  const { data, error } = await runCheckpointQuery<CheckpointSnapshot>(async () =>
    await context.supabase
      .from(CHECKPOINT_TABLE)
      .select("status, payload, fingerprint, attempts")
      .eq("meeting_id", context.meetingId)
      .eq("step_name", stepName)
      .maybeSingle()
  );

  if (error) {
    if (classifyCheckpointStoreError(error) === "transient") {
      const reconciled = await reconcileFromFallback(context, stepName, fingerprint, startedAt);
      if (reconciled) return reconciled;
    }
    throw toCheckpointLoadError(stepName, error);
  }

  return data;
}

function toCheckpointLoadError(stepName: string, error: unknown): Error {
  const message = getErrorMessage(error);

  if (classifyCheckpointStoreError(error) === "permanent") {
    return toNonRetriableJobError(
      `Checkpoint '${stepName}' could not be loaded due to a permanent store error ` +
        `(apply migration 033_job_checkpoints.sql if the table is missing): ${message}`,
      error
    );
  }

  // Transient: a plain error lets Inngest retry the step when Postgres is back
  // instead of re-executing the expensive work blindly.
  return new Error(
    `Checkpoint '${stepName}' could not be loaded (transient store error): ${message}`
  );
}

/**
 * Postgres is unreachable after every retry: buffer the result in R2 so the
 * next attempt reconciles it instead of losing it and re-running `execute`.
 */
async function degradePersistToFallback<T>(input: {
  context: CheckpointContext;
  stepName: string;
  fingerprint: string;
  result: T;
  attempt: number;
  startedAt: number;
  lastError: unknown;
}): Promise<void> {
  const { context, stepName, lastError } = input;
  const buffered = await writeCheckpointFallback(context.meetingId, stepName, {
    payload: input.result as unknown as Json,
    fingerprint: input.fingerprint,
    attempts: input.attempt,
    savedAt: new Date().toISOString(),
  });
  const outcome = buffered ? "persist_failed_buffered_r2" : "persist_failed_degraded";

  logCheckpointEvent({
    level: "error",
    outcome,
    stepName,
    context,
    startedAt: input.startedAt,
    attempt: input.attempt,
    error: lastError ?? undefined,
  });
  captureCheckpointError({
    error: lastError,
    outcome,
    stepName,
    context,
    startedAt: input.startedAt,
  });
}

async function persistCheckpoint<T>(input: {
  context: CheckpointContext;
  stepName: string;
  fingerprint: string;
  result: T;
  attempt: number;
  startedAt: number;
}): Promise<void> {
  const { context, stepName } = input;
  let lastError: unknown = null;

  for (let retryIndex = 0; retryIndex < CHECKPOINT_PERSIST_MAX_ATTEMPTS; retryIndex += 1) {
    if (retryIndex > 0) {
      logCheckpointEvent({
        level: "warn",
        outcome: "persist_retry",
        stepName,
        context,
        startedAt: input.startedAt,
        attempt: input.attempt,
        error: lastError ?? undefined,
      });
      await sleep(computeCheckpointBackoffDelayMs(retryIndex - 1));
    }

    const { error } = await runCheckpointQuery(async () =>
      await context.supabase.from(CHECKPOINT_TABLE).upsert(
        {
          meeting_id: context.meetingId,
          job_id: context.jobId,
          user_id: context.userId,
          step_name: stepName,
          status: "completed",
          payload: input.result as unknown as Json,
          fingerprint: input.fingerprint,
          attempts: input.attempt,
          error: null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: CHECKPOINT_CONFLICT_TARGET }
      )
    );

    if (!error) {
      logCheckpointEvent({
        level: "info",
        outcome: "persisted",
        stepName,
        context,
        startedAt: input.startedAt,
        attempt: input.attempt,
      });
      return;
    }

    lastError = error;

    if (classifyCheckpointStoreError(error) === "permanent") {
      throw toNonRetriableJobError(
        `Checkpoint '${stepName}' could not be persisted due to a permanent store error: ${getErrorMessage(error)}`,
        error
      );
    }
  }

  await degradePersistToFallback({ ...input, lastError });
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Returns the checkpointed payload for `stepName` when a completed checkpoint
 * with a matching fingerprint exists; otherwise runs `execute`, persists the
 * result as the new checkpoint and returns it.
 *
 * The caller is responsible for materializing side effects from the returned
 * payload on every attempt (idempotent Postgres writes), so a retry after a
 * materialization failure never re-runs `execute`.
 */
export async function withCheckpoint<T>(input: WithCheckpointInput<T>): Promise<T> {
  const startedAt = Date.now();
  const context: CheckpointContext = {
    supabase: input.supabase,
    meetingId: input.meetingId,
    jobId: input.jobId,
    userId: input.userId,
  };

  const existing = await loadCheckpoint(context, input.stepName, input.fingerprint, startedAt);

  if (existing && existing.status === "completed" && existing.payload !== null) {
    if (existing.fingerprint === input.fingerprint) {
      logCheckpointEvent({
        level: "info",
        outcome: "checkpoint_hit",
        stepName: input.stepName,
        context,
        startedAt,
        attempt: existing.attempts,
      });
      return existing.payload as unknown as T;
    }

    logCheckpointEvent({
      level: "warn",
      outcome: "invalid_fingerprint",
      stepName: input.stepName,
      context,
      startedAt,
      attempt: existing.attempts,
    });
  }

  // No usable Postgres row (or a mismatched one): before paying for `execute`
  // again, check whether R2 already has this exact result buffered.
  const reconciled = await reconcileFromFallback(
    context,
    input.stepName,
    input.fingerprint,
    startedAt
  );
  if (reconciled) return reconciled.payload as unknown as T;

  const result = await input.execute();

  await persistCheckpoint({
    context,
    stepName: input.stepName,
    fingerprint: input.fingerprint,
    result,
    attempt: (existing?.attempts ?? 0) + 1,
    startedAt,
  });

  logCheckpointEvent({
    level: "info",
    outcome: "executed",
    stepName: input.stepName,
    context,
    startedAt,
    attempt: (existing?.attempts ?? 0) + 1,
  });

  return result;
}

/**
 * Best-effort cleanup of any R2 fallback objects left over for a meeting.
 * Normally none remain — reconciliation deletes its object as soon as
 * Postgres has the row — but this covers the edge case where a step stayed
 * buffered in R2 until the job otherwise completed successfully.
 */
async function purgeMeetingFallbacks(meetingId: string): Promise<void> {
  try {
    const keys = await listObjectKeys(`checkpoints/${meetingId}/`);
    await Promise.all(keys.map((key) => deleteObject(key).catch(() => undefined)));
  } catch {
    // Best-effort: leftover fallback objects are harmless orphans.
  }
}

/**
 * Best-effort cleanup of all checkpoints for a meeting once the job completed
 * successfully. Never throws: a purge failure must not fail the cleanup step.
 */
export async function purgeMeetingCheckpoints(
  context: CheckpointContext
): Promise<void> {
  const startedAt = Date.now();
  const stepName = "(all)";

  const { error } = await runCheckpointQuery(async () =>
    await context.supabase
      .from(CHECKPOINT_TABLE)
      .delete()
      .eq("meeting_id", context.meetingId)
  );

  if (error) {
    logCheckpointEvent({
      level: "error",
      outcome: "purge_failed",
      stepName,
      context,
      startedAt,
      error,
    });
    captureCheckpointError({ error, outcome: "purge_failed", stepName, context, startedAt });
    return;
  }

  await purgeMeetingFallbacks(context.meetingId);

  logCheckpointEvent({
    level: "info",
    outcome: "purged",
    stepName,
    context,
    startedAt,
  });
}
