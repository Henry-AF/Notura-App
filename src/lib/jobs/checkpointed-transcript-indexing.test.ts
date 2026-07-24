import type { SupabaseClient } from "@supabase/supabase-js";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Database } from "@/types/database";

const mocks = vi.hoisted(() => ({
  captureObservedError: vi.fn(),
  deleteObject: vi.fn(),
  getJsonObject: vi.fn(),
  listObjectKeys: vi.fn(),
  logStructured: vi.fn(),
  putJsonObject: vi.fn(),
  upsertMeetingChunksWithAdvisoryLock: vi.fn(),
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

vi.mock("@/lib/gemini", () => ({
  EMBEDDING_MODEL_NAME: "gemini-embedding-001",
  EMBEDDING_OUTPUT_DIMENSIONS: 768,
}));

vi.mock("@/lib/meetings/rag", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/meetings/rag")>();
  return {
    ...original,
    upsertMeetingChunksWithAdvisoryLock:
      mocks.upsertMeetingChunksWithAdvisoryLock,
  };
});

import type { TranscriptUtteranceInput } from "@/lib/meetings/rag";
import {
  INDEX_TRANSCRIPT_CHUNKS_STEP,
  indexTranscriptChunksWithCheckpoints,
} from "./checkpointed-transcript-indexing";

type SupabaseAdminClient = SupabaseClient<Database>;

interface StoredCheckpoint {
  status: string;
  payload: unknown;
  fingerprint: string | null;
  attempts: number;
}

function createCheckpointSupabaseFake() {
  const store = new Map<string, StoredCheckpoint>();

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
            const key = `${String(filters.meeting_id)}::${String(filters.step_name)}`;
            return Promise.resolve({ data: store.get(key) ?? null, error: null });
          }),
        };
        return builder;
      }),
      upsert: vi.fn((payload: Record<string, unknown>) => {
        store.set(`${String(payload.meeting_id)}::${String(payload.step_name)}`, {
          status: String(payload.status),
          payload: payload.payload,
          fingerprint: (payload.fingerprint as string | null) ?? null,
          attempts: Number(payload.attempts),
        });
        return Promise.resolve({ error: null });
      }),
    })),
  };

  return {
    client: client as unknown as SupabaseAdminClient,
    store,
  };
}

const CHUNK_COUNT = 45; // 3 batches of 20/20/5 with TRANSCRIPT_INDEXING_BATCH_SIZE=20
const TRANSCRIPT = "transcricao da reuniao";

function buildUtterances(count: number, prefix = "u"): TranscriptUtteranceInput[] {
  // ~351 words per utterance forces one chunk per utterance (target is 400).
  const filler = Array.from({ length: 350 }, () => "palavra").join(" ");
  return Array.from({ length: count }, (_, index) => ({
    speaker: "A",
    text: `${prefix}${index} ${filler}`,
    start: index * 1000,
    end: index * 1000 + 500,
  }));
}

function createEmbedText(failOnCall: number | null = null) {
  let calls = 0;
  return vi.fn((): Promise<number[]> => {
    calls += 1;
    if (failOnCall !== null && calls === failOnCall) {
      return Promise.reject(new Error("gemini temporarily unavailable"));
    }
    return Promise.resolve([calls]);
  });
}

function createInput(client: SupabaseAdminClient, embedText: (text: string) => Promise<number[]>) {
  return {
    supabase: client,
    meetingId: "meeting-1",
    jobId: "job-1",
    userId: "user-1",
    transcript: TRANSCRIPT,
    utterances: buildUtterances(CHUNK_COUNT),
    embedText,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.upsertMeetingChunksWithAdvisoryLock.mockResolvedValue(undefined);
  mocks.getJsonObject.mockResolvedValue(null);
  mocks.putJsonObject.mockResolvedValue(undefined);
  mocks.deleteObject.mockResolvedValue(undefined);
  mocks.listObjectKeys.mockResolvedValue([]);
});

describe("indexTranscriptChunksWithCheckpoints - resuming after failures", () => {
  it("resumes from the failed batch without re-embedding completed batches", async () => {
    const { client, store } = createCheckpointSupabaseFake();

    // Run 1: the embed call for the first chunk of batch 2 (call 41) fails.
    // The embedding pool (concurrency 2) still attempts the remaining chunks
    // of the batch, but nothing from batch 2 is checkpointed.
    const firstEmbed = createEmbedText(41);
    await expect(
      indexTranscriptChunksWithCheckpoints(createInput(client, firstEmbed))
    ).rejects.toThrow("gemini temporarily unavailable");

    expect(firstEmbed).toHaveBeenCalledTimes(CHUNK_COUNT);
    expect(mocks.upsertMeetingChunksWithAdvisoryLock).toHaveBeenCalledTimes(2);
    expect(store.has(`meeting-1::${INDEX_TRANSCRIPT_CHUNKS_STEP}:batch:0000`)).toBe(true);
    expect(store.has(`meeting-1::${INDEX_TRANSCRIPT_CHUNKS_STEP}:batch:0001`)).toBe(true);
    expect(store.has(`meeting-1::${INDEX_TRANSCRIPT_CHUNKS_STEP}:batch:0002`)).toBe(false);

    // Run 2: batches 0 and 1 come from checkpoints; only batch 2 is embedded.
    const secondEmbed = createEmbedText();
    const summary = await indexTranscriptChunksWithCheckpoints(
      createInput(client, secondEmbed)
    );

    expect(summary).toEqual({ chunkCount: CHUNK_COUNT, batchCount: 3 });
    expect(secondEmbed).toHaveBeenCalledTimes(5);
    const reEmbeddedTexts = secondEmbed.mock.calls.map(([text]) => text);
    expect(
      reEmbeddedTexts.every((text) => /^u4[0-4] /.test(text))
    ).toBe(true);
    // Completed batches are still re-upserted (idempotent materialization).
    expect(mocks.upsertMeetingChunksWithAdvisoryLock).toHaveBeenCalledTimes(2 + 3);
  });

  it("retries the batch materialization without re-embedding when Postgres fails after the checkpoint", async () => {
    const { client } = createCheckpointSupabaseFake();
    mocks.upsertMeetingChunksWithAdvisoryLock
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error("connection reset by peer"));

    // Run 1: batch 1 is embedded and checkpointed, then its upsert fails.
    const firstEmbed = createEmbedText();
    await expect(
      indexTranscriptChunksWithCheckpoints(createInput(client, firstEmbed))
    ).rejects.toThrow("connection reset by peer");

    expect(firstEmbed).toHaveBeenCalledTimes(40);
    expect(mocks.upsertMeetingChunksWithAdvisoryLock).toHaveBeenCalledTimes(2);

    // Run 2: batches 0 and 1 replay from checkpoints (zero re-embed); only
    // batch 2 is embedded. All three batches are upserted.
    const secondEmbed = createEmbedText();
    const summary = await indexTranscriptChunksWithCheckpoints(
      createInput(client, secondEmbed)
    );

    expect(summary).toEqual({ chunkCount: CHUNK_COUNT, batchCount: 3 });
    expect(secondEmbed).toHaveBeenCalledTimes(5);
    expect(mocks.upsertMeetingChunksWithAdvisoryLock).toHaveBeenCalledTimes(2 + 3);

    const reupsertedBatch1Rows = mocks.upsertMeetingChunksWithAdvisoryLock.mock
      .calls[3][3] as Array<{ embedding: number[] }>;
    expect(reupsertedBatch1Rows).toHaveLength(20);
    expect(
      reupsertedBatch1Rows.every((row) => Array.isArray(row.embedding))
    ).toBe(true);
  });
});

describe("indexTranscriptChunksWithCheckpoints - step-level checkpoint reuse", () => {
  it("skips the whole step when the step-level checkpoint is completed", async () => {
    const { client } = createCheckpointSupabaseFake();

    const firstEmbed = createEmbedText();
    await indexTranscriptChunksWithCheckpoints(createInput(client, firstEmbed));
    expect(firstEmbed).toHaveBeenCalledTimes(CHUNK_COUNT);
    expect(mocks.upsertMeetingChunksWithAdvisoryLock).toHaveBeenCalledTimes(3);

    const secondEmbed = createEmbedText();
    const summary = await indexTranscriptChunksWithCheckpoints(
      createInput(client, secondEmbed)
    );

    expect(summary).toEqual({ chunkCount: CHUNK_COUNT, batchCount: 3 });
    expect(secondEmbed).not.toHaveBeenCalled();
    expect(mocks.upsertMeetingChunksWithAdvisoryLock).toHaveBeenCalledTimes(3);
    expect(mocks.logStructured).toHaveBeenCalledWith(
      "info",
      expect.objectContaining({
        event: "inngest.checkpoint.checkpoint_hit",
        step: INDEX_TRANSCRIPT_CHUNKS_STEP,
      })
    );
  });

  it("re-executes everything when the fingerprint no longer matches", async () => {
    const { client } = createCheckpointSupabaseFake();

    const firstEmbed = createEmbedText();
    await indexTranscriptChunksWithCheckpoints(createInput(client, firstEmbed));
    expect(firstEmbed).toHaveBeenCalledTimes(CHUNK_COUNT);

    const secondEmbed = createEmbedText();
    await indexTranscriptChunksWithCheckpoints({
      ...createInput(client, secondEmbed),
      transcript: "outra transcricao",
    });

    expect(secondEmbed).toHaveBeenCalledTimes(CHUNK_COUNT);
    expect(mocks.upsertMeetingChunksWithAdvisoryLock).toHaveBeenCalledTimes(6);
  });
});
