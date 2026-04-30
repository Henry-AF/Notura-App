export const MAX_CHAT_QUESTION_CHARS = 500;
export const MAX_CHAT_QUESTION_SENTENCES = 3;
export const TRANSCRIPT_CHUNK_TARGET_TOKENS = 400;

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
