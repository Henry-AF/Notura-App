import type { SupabaseClient } from "@supabase/supabase-js";
import {
  EMBEDDING_MODEL_NAME,
  EMBEDDING_OUTPUT_DIMENSIONS,
} from "@/lib/gemini";
import type { Database, Json, MeetingTranscriptChunk } from "@/types/database";

export const MAX_CHAT_QUESTION_CHARS = 500;
export const MAX_CHAT_QUESTION_SENTENCES = 3;
export const TRANSCRIPT_CHUNK_TARGET_TOKENS = 400;
export const CHAT_RETRIEVAL_LIMIT = 5;
export const CHAT_SIMILARITY_THRESHOLD = 0.6;
export const ACTIVE_TRANSCRIPT_EMBEDDING_MODEL = EMBEDDING_MODEL_NAME;
export const ACTIVE_TRANSCRIPT_EMBEDDING_DIMENSIONS = EMBEDDING_OUTPUT_DIMENSIONS;
export const TRANSCRIPT_CHUNKING_VERSION = "utterance-merge-v1-400";

type SupabaseAdminClient = SupabaseClient<Database>;
type ChunkInsert =
  Database["public"]["Tables"]["meeting_transcript_chunks"]["Insert"];
type ChunkUpsertPayload =
  Database["public"]["Functions"]["upsert_meeting_transcript_chunks_with_lock"]["Args"]["p_chunks"];
export type MatchedTranscriptChunk =
  Database["public"]["Functions"]["match_meeting_transcript_chunks"]["Returns"][number];

export type MeetingChatFallbackReason =
  | "question_too_long"
  | "meeting_not_ready"
  | "no_transcript"
  | "low_similarity"
  | "not_confirmed_by_model"
  | "provider_error";

export class MeetingChatValidationError extends Error {
  constructor(readonly reason: MeetingChatFallbackReason) {
    super(reason);
    this.name = "MeetingChatValidationError";
  }
}

export interface TranscriptUtteranceInput {
  speaker?: string | null;
  text: string;
  start?: number | null;
  end?: number | null;
}

export interface TranscriptChunk {
  chunkIndex: number;
  text: string;
  speaker: string | null;
  startMs: number | null;
  endMs: number | null;
  metadata: {
    speakers: string[];
    utteranceCount: number;
    utterances: Array<{
      speaker: string | null;
      text: string;
      startMs: number | null;
      endMs: number | null;
    }>;
  };
}

export interface ChatSource {
  chunkId: string;
  similarity: number;
  startMs: number | null;
  endMs: number | null;
  speaker: string | null;
  text: string;
}

interface IndexMeetingTranscriptChunksInput {
  supabase: SupabaseAdminClient;
  meetingId: string;
  userId: string;
  transcript: string;
  utterances?: TranscriptUtteranceInput[] | null;
  embedText: (text: string) => Promise<number[]>;
}

interface EnsureMeetingChunksIndexedInput {
  supabase: SupabaseAdminClient;
  meeting: {
    id: string;
    user_id: string;
    transcript: string | null;
  };
  embedText: (text: string) => Promise<number[]>;
}

interface MatchMeetingTranscriptChunksInput {
  supabase: SupabaseAdminClient;
  userId: string;
  meetingId: string;
  queryEmbedding: number[];
}

interface NormalizedUtterance {
  speaker: string | null;
  text: string;
  startMs: number | null;
  endMs: number | null;
}

export function estimateTokenCount(text: string): number {
  const normalized = text.trim();
  if (!normalized) return 0;
  return normalized.split(/\s+/).length;
}

export function validateMeetingChatQuestion(question: unknown): string {
  if (typeof question !== "string") {
    throw new MeetingChatValidationError("question_too_long");
  }

  const normalized = question.normalize("NFKC").replace(/\s+/g, " ").trim();
  const sentenceCount = normalized.match(/[.!?]+(?=\s|$)/g)?.length ?? 0;

  if (
    !normalized ||
    normalized.length > MAX_CHAT_QUESTION_CHARS ||
    sentenceCount > MAX_CHAT_QUESTION_SENTENCES
  ) {
    throw new MeetingChatValidationError("question_too_long");
  }

  return normalized;
}

export function buildTranscriptChunksFromUtterances(
  utterances: TranscriptUtteranceInput[]
): TranscriptChunk[] {
  const normalized = utterances.map(normalizeUtterance).filter(isPresentUtterance);
  const groups = groupUtterancesByTokenTarget(normalized);
  return groups.map((group, index) => buildChunk(group, index));
}

export function buildTranscriptChunksFromFormattedTranscript(
  transcript: string
): TranscriptChunk[] {
  const parsed = transcript
    .split(/\n+/)
    .map(parseFormattedTranscriptLine)
    .filter(isPresentUtterance);

  if (parsed.length > 0) {
    return groupUtterancesByTokenTarget(parsed).map((group, index) =>
      buildChunk(group, index)
    );
  }

  const trimmed = transcript.trim();
  if (!trimmed) return [];
  return buildTranscriptChunksFromUtterances([{ text: trimmed }]);
}

export async function indexMeetingTranscriptChunks({
  supabase,
  meetingId,
  userId,
  transcript,
  utterances,
  embedText,
}: IndexMeetingTranscriptChunksInput): Promise<TranscriptChunk[]> {
  const chunks = buildChunksForIndexing(transcript, utterances);
  const rows =
    chunks.length > 0
      ? await buildChunkInsertRows(chunks, meetingId, userId, embedText)
      : [];

  await upsertMeetingChunksWithAdvisoryLock(supabase, meetingId, userId, rows);

  return chunks;
}

export async function ensureMeetingChunksIndexed({
  supabase,
  meeting,
  embedText,
}: EnsureMeetingChunksIndexedInput): Promise<MeetingTranscriptChunk[]> {
  const existing = await fetchMeetingChunks(supabase, meeting.id);
  if (existing.length > 0) return existing;

  if (!meeting.transcript) {
    throw new MeetingChatValidationError("no_transcript");
  }

  await indexMeetingTranscriptChunks({
    supabase,
    meetingId: meeting.id,
    userId: meeting.user_id,
    transcript: meeting.transcript,
    embedText,
  });

  return fetchMeetingChunks(supabase, meeting.id);
}

export async function matchMeetingTranscriptChunks({
  supabase,
  userId,
  meetingId,
  queryEmbedding,
}: MatchMeetingTranscriptChunksInput): Promise<MatchedTranscriptChunk[]> {
  const { data, error } = await supabase.rpc("match_meeting_transcript_chunks", {
    p_user_id: userId,
    p_meeting_id: meetingId,
    p_query_embedding: queryEmbedding,
    p_limit: CHAT_RETRIEVAL_LIMIT,
    p_similarity_threshold: CHAT_SIMILARITY_THRESHOLD,
    p_embedding_model: ACTIVE_TRANSCRIPT_EMBEDDING_MODEL,
    p_embedding_dimensions: ACTIVE_TRANSCRIPT_EMBEDDING_DIMENSIONS,
    p_chunking_version: TRANSCRIPT_CHUNKING_VERSION,
  });

  if (error) throw new Error(`Failed to match transcript chunks: ${error.message}`);
  return data ?? [];
}

export function toChatSources(chunks: MatchedTranscriptChunk[]): ChatSource[] {
  return chunks.map((chunk) => ({
    chunkId: chunk.id,
    similarity: chunk.similarity,
    startMs: chunk.start_ms,
    endMs: chunk.end_ms,
    speaker: chunk.speaker,
    text: chunk.text,
  }));
}

function normalizeUtterance(input: TranscriptUtteranceInput): NormalizedUtterance {
  return {
    speaker: normalizeSpeaker(input.speaker),
    text: input.text.normalize("NFKC").replace(/\s+/g, " ").trim(),
    startMs: normalizeOffset(input.start),
    endMs: normalizeOffset(input.end),
  };
}

function isPresentUtterance(
  utterance: NormalizedUtterance | null
): utterance is NormalizedUtterance {
  return utterance !== null && utterance.text.length > 0;
}

function normalizeSpeaker(speaker: string | null | undefined): string | null {
  if (typeof speaker !== "string") return null;
  const trimmed = speaker.trim();
  return trimmed ? trimmed : null;
}

function normalizeOffset(value: number | null | undefined): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return Math.max(0, Math.trunc(value));
}

function groupUtterancesByTokenTarget(
  utterances: NormalizedUtterance[]
): NormalizedUtterance[][] {
  const groups: NormalizedUtterance[][] = [];
  let current: NormalizedUtterance[] = [];
  let tokenCount = 0;

  for (const utterance of utterances) {
    const nextTokens = estimateTokenCount(utterance.text);
    if (current.length > 0 && tokenCount + nextTokens > TRANSCRIPT_CHUNK_TARGET_TOKENS) {
      groups.push(current);
      current = [];
      tokenCount = 0;
    }

    current.push(utterance);
    tokenCount += nextTokens;
  }

  if (current.length > 0) groups.push(current);
  return groups;
}

function buildChunk(group: NormalizedUtterance[], index: number): TranscriptChunk {
  const speakers = uniqueSpeakers(group);
  const first = group[0];
  const last = group[group.length - 1];

  return {
    chunkIndex: index,
    text: group.map((utterance) => utterance.text).join("\n"),
    speaker: speakers.length === 1 ? speakers[0] : null,
    startMs: first.startMs,
    endMs: last.endMs ?? last.startMs,
    metadata: {
      speakers,
      utteranceCount: group.length,
      utterances: group.map((utterance) => ({ ...utterance })),
    },
  };
}

function uniqueSpeakers(group: NormalizedUtterance[]): string[] {
  return Array.from(
    new Set(
      group
        .map((utterance) => utterance.speaker)
        .filter((speaker): speaker is string => speaker !== null)
    )
  );
}

function parseFormattedTranscriptLine(line: string): NormalizedUtterance | null {
  const match = line
    .trim()
    .match(/^\[(\d{2}):(\d{2})\]\s+Speaker\s+([^:]+):\s*(.+)$/i);
  if (!match) return null;

  const startMs = (Number(match[1]) * 60 + Number(match[2])) * 1000;
  return {
    speaker: normalizeSpeaker(match[3]),
    text: match[4].normalize("NFKC").replace(/\s+/g, " ").trim(),
    startMs,
    endMs: startMs,
  };
}

function buildChunksForIndexing(
  transcript: string,
  utterances: TranscriptUtteranceInput[] | null | undefined
): TranscriptChunk[] {
  if (utterances && utterances.length > 0) {
    return buildTranscriptChunksFromUtterances(utterances);
  }

  return buildTranscriptChunksFromFormattedTranscript(transcript);
}

async function upsertMeetingChunksWithAdvisoryLock(
  supabase: SupabaseAdminClient,
  meetingId: string,
  userId: string,
  rows: ChunkInsert[]
): Promise<void> {
  const chunks = rows.map(({ meeting_id: _meetingId, user_id: _userId, ...row }) => row);
  const { error } = await supabase.rpc(
    "upsert_meeting_transcript_chunks_with_lock",
    {
      p_meeting_id: meetingId,
      p_user_id: userId,
      p_embedding_model: ACTIVE_TRANSCRIPT_EMBEDDING_MODEL,
      p_embedding_dimensions: ACTIVE_TRANSCRIPT_EMBEDDING_DIMENSIONS,
      p_chunking_version: TRANSCRIPT_CHUNKING_VERSION,
      p_chunks: chunks as ChunkUpsertPayload,
    }
  );

  if (error) {
    throw new Error(`Failed to upsert transcript chunks with advisory lock: ${error.message}`);
  }
}

async function buildChunkInsertRows(
  chunks: TranscriptChunk[],
  meetingId: string,
  userId: string,
  embedText: (text: string) => Promise<number[]>
): Promise<ChunkInsert[]> {
  return Promise.all(
    chunks.map(async (chunk) => ({
      meeting_id: meetingId,
      user_id: userId,
      chunk_index: chunk.chunkIndex,
      text: chunk.text,
      speaker: chunk.speaker,
      start_ms: chunk.startMs,
      end_ms: chunk.endMs,
      metadata: chunk.metadata as unknown as Json,
      embedding: await embedText(chunk.text),
    }))
  );
}

async function fetchMeetingChunks(
  supabase: SupabaseAdminClient,
  meetingId: string
): Promise<MeetingTranscriptChunk[]> {
  const { data, error } = await supabase
    .from("meeting_transcript_chunks")
    .select("*")
    .eq("meeting_id", meetingId)
    .eq("embedding_model", ACTIVE_TRANSCRIPT_EMBEDDING_MODEL)
    .eq("embedding_dimensions", ACTIVE_TRANSCRIPT_EMBEDDING_DIMENSIONS)
    .eq("chunking_version", TRANSCRIPT_CHUNKING_VERSION)
    .order("chunk_index", { ascending: true });

  if (error) throw new Error(`Failed to fetch transcript chunks: ${error.message}`);
  return data ?? [];
}
