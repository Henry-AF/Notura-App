// ─────────────────────────────────────────────────────────────────────────────
// Checkpointed transcript chunk indexing (NOT-69).
//
// Splits the chunk embedding + persistence work of `index-transcript-chunks`
// into batches: each batch is embedded (Gemini), checkpointed and upserted
// before the next one starts. A retry resumes from the failed batch and
// replays completed batches straight from their checkpoint payloads — no
// re-embedding, no duplicate Gemini calls.
// ─────────────────────────────────────────────────────────────────────────────

import {
  buildCheckpointFingerprint,
  withCheckpoint,
  type CheckpointContext,
} from "@/lib/jobs/checkpoints";
import {
  ACTIVE_TRANSCRIPT_EMBEDDING_DIMENSIONS,
  ACTIVE_TRANSCRIPT_EMBEDDING_MODEL,
  TRANSCRIPT_CHUNKING_VERSION,
  buildChunkInsertRows,
  buildTranscriptChunksFromFormattedTranscript,
  buildTranscriptChunksFromUtterances,
  upsertMeetingChunksWithAdvisoryLock,
  type ChunkInsert,
  type TranscriptChunk,
  type TranscriptUtteranceInput,
} from "@/lib/meetings/rag";

export const TRANSCRIPT_INDEXING_BATCH_SIZE = 20;
export const INDEX_TRANSCRIPT_CHUNKS_STEP = "index-transcript-chunks";

export interface IndexTranscriptChunksWithCheckpointsInput
  extends CheckpointContext {
  transcript: string;
  utterances?: TranscriptUtteranceInput[] | null;
  embedText: (text: string) => Promise<number[]>;
}

export interface IndexTranscriptChunksSummary {
  chunkCount: number;
  batchCount: number;
}

interface TranscriptBatchCheckpointPayload {
  rows: ChunkInsert[];
}

export function buildTranscriptIndexingFingerprint(transcript: string): string {
  return buildCheckpointFingerprint([
    transcript,
    TRANSCRIPT_CHUNKING_VERSION,
    ACTIVE_TRANSCRIPT_EMBEDDING_MODEL,
    ACTIVE_TRANSCRIPT_EMBEDDING_DIMENSIONS,
  ]);
}

function buildBatchStepName(batchIndex: number): string {
  return `${INDEX_TRANSCRIPT_CHUNKS_STEP}:batch:${String(batchIndex).padStart(4, "0")}`;
}

function partitionIntoBatches(
  chunks: TranscriptChunk[],
  batchSize: number
): TranscriptChunk[][] {
  const batches: TranscriptChunk[][] = [];
  for (let start = 0; start < chunks.length; start += batchSize) {
    batches.push(chunks.slice(start, start + batchSize));
  }
  return batches;
}

export async function indexTranscriptChunksWithCheckpoints(
  input: IndexTranscriptChunksWithCheckpointsInput
): Promise<IndexTranscriptChunksSummary> {
  const chunks =
    input.utterances && input.utterances.length > 0
      ? buildTranscriptChunksFromUtterances(input.utterances)
      : buildTranscriptChunksFromFormattedTranscript(input.transcript);
  const fingerprint = buildTranscriptIndexingFingerprint(input.transcript);

  // Step-level checkpoint: when it exists, every batch was already embedded
  // AND upserted in a previous run, so the whole step is skipped.
  return await withCheckpoint<IndexTranscriptChunksSummary>({
    ...input,
    stepName: INDEX_TRANSCRIPT_CHUNKS_STEP,
    fingerprint,
    execute: async () => {
      const batches = partitionIntoBatches(chunks, TRANSCRIPT_INDEXING_BATCH_SIZE);

      for (const [batchIndex, batch] of batches.entries()) {
        const { rows } = await withCheckpoint<TranscriptBatchCheckpointPayload>({
          ...input,
          stepName: buildBatchStepName(batchIndex),
          fingerprint,
          execute: async () => ({
            rows: await buildChunkInsertRows(
              batch,
              input.meetingId,
              input.userId,
              input.embedText
            ),
          }),
        });

        // Materialization is idempotent (advisory-lock upsert) and runs on
        // every attempt, so batches replayed from a checkpoint are guaranteed
        // to exist in Postgres without being re-embedded.
        await upsertMeetingChunksWithAdvisoryLock(
          input.supabase,
          input.meetingId,
          input.userId,
          rows
        );
      }

      return { chunkCount: chunks.length, batchCount: batches.length };
    },
  });
}
