import { describe, expect, it, vi } from "vitest";
import type { Database } from "../../types/database";
import {
  ACTIVE_TRANSCRIPT_EMBEDDING_DIMENSIONS,
  ACTIVE_TRANSCRIPT_EMBEDDING_MODEL,
  buildTranscriptChunksFromFormattedTranscript,
  buildTranscriptChunksFromUtterances,
  ensureMeetingChunksIndexed,
  indexMeetingTranscriptChunks,
  matchMeetingTranscriptChunks,
  toChatSources,
  TRANSCRIPT_CHUNKING_VERSION,
  validateMeetingChatQuestion,
} from "./rag";

type ChunkRow = Database["public"]["Tables"]["meeting_transcript_chunks"]["Row"];
type ChatRow = Database["public"]["Tables"]["meeting_chats"]["Row"];
type MatchArgs =
  Database["public"]["Functions"]["match_meeting_transcript_chunks"]["Args"];

describe("meeting RAG database types", () => {
  it("documents the meeting RAG table names used by the backend", () => {
    const tableNames = [
      "meeting_transcript_chunks",
      "meeting_chats",
    ] satisfies Array<keyof Database["public"]["Tables"]>;

    const _chunkId: ChunkRow["id"] = "chunk-1";
    const _chatId: ChatRow["id"] = "chat-1";
    const _limit: MatchArgs["p_limit"] = 5;
    const _embeddingModel: ChunkRow["embedding_model"] =
      ACTIVE_TRANSCRIPT_EMBEDDING_MODEL;
    const _embeddingDimensions: ChunkRow["embedding_dimensions"] =
      ACTIVE_TRANSCRIPT_EMBEDDING_DIMENSIONS;
    const _chunkingVersion: ChunkRow["chunking_version"] =
      TRANSCRIPT_CHUNKING_VERSION;
    const _matchEmbeddingModel: MatchArgs["p_embedding_model"] =
      ACTIVE_TRANSCRIPT_EMBEDDING_MODEL;

    expect(tableNames).toEqual(["meeting_transcript_chunks", "meeting_chats"]);
    expect(_chunkId).toBe("chunk-1");
    expect(_chatId).toBe("chat-1");
    expect(_limit).toBe(5);
    expect(_embeddingModel).toBe("gemini-embedding-001");
    expect(_embeddingDimensions).toBe(768);
    expect(_chunkingVersion).toBe("utterance-merge-v1-400");
    expect(_matchEmbeddingModel).toBe("gemini-embedding-001");
  });
});

function repeatedWords(count: number): string {
  return Array.from({ length: count }, (_, index) => `palavra${index}`).join(" ");
}

describe("validateMeetingChatQuestion", () => {
  it("normalizes a short meeting question", () => {
    expect(validateMeetingChatQuestion("  Qual foi o prazo combinado?  ")).toBe(
      "Qual foi o prazo combinado?"
    );
  });

  it("rejects questions longer than 500 characters", () => {
    expect(() => validateMeetingChatQuestion("a".repeat(501))).toThrow(
      "question_too_long"
    );
  });

  it("rejects questions with more than three sentences", () => {
    expect(() =>
      validateMeetingChatQuestion("Uma? Duas? Tres? Quatro?")
    ).toThrow("question_too_long");
  });
});

describe("buildTranscriptChunksFromUtterances", () => {
  it("merges utterances until the next one would exceed the token target", () => {
    const chunks = buildTranscriptChunksFromUtterances([
      { speaker: "A", text: repeatedWords(150), start: 0, end: 1000 },
      { speaker: "A", text: repeatedWords(180), start: 1000, end: 2000 },
      { speaker: "B", text: repeatedWords(120), start: 2000, end: 3000 },
    ]);

    expect(chunks).toHaveLength(2);
    expect(chunks[0]).toMatchObject({
      chunkIndex: 0,
      speaker: "A",
      startMs: 0,
      endMs: 2000,
    });
    expect(chunks[0].metadata).toMatchObject({
      speakers: ["A"],
      utteranceCount: 2,
    });
    expect(chunks[1]).toMatchObject({
      chunkIndex: 1,
      speaker: "B",
      startMs: 2000,
      endMs: 3000,
    });
  });

  it("sets speaker to null when a chunk contains multiple speakers", () => {
    const chunks = buildTranscriptChunksFromUtterances([
      { speaker: "A", text: "Primeira fala", start: 0, end: 1000 },
      { speaker: "B", text: "Segunda fala", start: 1000, end: 2000 },
    ]);

    expect(chunks[0].speaker).toBeNull();
    expect(chunks[0].metadata).toMatchObject({
      speakers: ["A", "B"],
      utteranceCount: 2,
    });
  });
});

describe("buildTranscriptChunksFromFormattedTranscript", () => {
  it("parses timestamp and speaker metadata from stored transcripts", () => {
    const chunks = buildTranscriptChunksFromFormattedTranscript(
      [
        "[00:12] Speaker A: Primeiro trecho discutido.",
        "",
        "[01:05] Speaker B: Segundo trecho com decisao.",
      ].join("\n")
    );

    expect(chunks).toHaveLength(1);
    expect(chunks[0]).toMatchObject({
      chunkIndex: 0,
      speaker: null,
      startMs: 12000,
      endMs: 65000,
    });
    expect(chunks[0].text).toContain("Primeiro trecho discutido.");
    expect(chunks[0].text).toContain("Segundo trecho com decisao.");
    expect(chunks[0].metadata).toMatchObject({
      speakers: ["A", "B"],
      utteranceCount: 2,
    });
  });

  it("parses stored transcript lines after 99 minutes", () => {
    const chunks = buildTranscriptChunksFromFormattedTranscript(
      "[100:05] Speaker A: Trecho perto do fim da reuniao."
    );

    expect(chunks).toHaveLength(1);
    expect(chunks[0]).toMatchObject({
      speaker: "A",
      startMs: 6005000,
      endMs: 6005000,
    });
    expect(chunks[0].text).toBe("Trecho perto do fim da reuniao.");
  });
});

function createEmbedding(seed: number): number[] {
  return Array.from({ length: 768 }, () => seed);
}

function createChunkPersistenceClient() {
  const rpc = vi.fn().mockResolvedValue({ error: null });
  const from = vi.fn();

  return { supabase: { from, rpc }, from, rpc };
}

describe("indexMeetingTranscriptChunks", () => {
  it("persists chunks through the advisory-locked upsert RPC", async () => {
    const { supabase, from, rpc } = createChunkPersistenceClient();
    const embedText = vi.fn().mockResolvedValue(createEmbedding(0.5));

    await indexMeetingTranscriptChunks({
      supabase: supabase as never,
      meetingId: "meeting-1",
      userId: "user-1",
      transcript: "fallback transcript",
      utterances: [
        { speaker: "A", text: "Primeira fala", start: 0, end: 1000 },
        { speaker: "A", text: "Segunda fala", start: 1000, end: 2000 },
      ],
      embedText,
    });

    expect(from).not.toHaveBeenCalled();
    expect(embedText).toHaveBeenCalledWith("Primeira fala\nSegunda fala");
    expect(rpc).toHaveBeenCalledWith("upsert_meeting_transcript_chunks_with_lock", {
      p_meeting_id: "meeting-1",
      p_user_id: "user-1",
      p_embedding_model: ACTIVE_TRANSCRIPT_EMBEDDING_MODEL,
      p_embedding_dimensions: ACTIVE_TRANSCRIPT_EMBEDDING_DIMENSIONS,
      p_chunking_version: TRANSCRIPT_CHUNKING_VERSION,
      p_chunks: [
        expect.objectContaining({
          chunk_index: 0,
          text: "Primeira fala\nSegunda fala",
          speaker: "A",
          start_ms: 0,
          end_ms: 2000,
          embedding: createEmbedding(0.5),
        }),
      ],
    });
  });
});

function createExistingChunksClient(data: unknown[]) {
  const order = vi.fn().mockResolvedValue({ data, error: null });
  const query = {
    eq: vi.fn(),
    order,
  };
  query.eq.mockReturnValue(query);
  const select = vi.fn(() => query);
  const from = vi.fn(() => ({ select }));

  return { supabase: { from }, eq: query.eq, order };
}

describe("ensureMeetingChunksIndexed", () => {
  it("returns existing chunks without embedding when a meeting is already indexed", async () => {
    const existing = [
      {
        id: "chunk-1",
        meeting_id: "meeting-1",
        chunk_index: 0,
        text: "Trecho",
        speaker: "A",
        start_ms: 0,
        end_ms: 1000,
        metadata: {},
        similarity: 0.9,
      },
    ];
    const { supabase, eq } = createExistingChunksClient(existing);
    const embedText = vi.fn();

    const chunks = await ensureMeetingChunksIndexed({
      supabase: supabase as never,
      meeting: {
        id: "meeting-1",
        user_id: "user-1",
        transcript: "Transcricao antiga",
      },
      embedText,
    });

    expect(chunks).toEqual(existing);
    expect(embedText).not.toHaveBeenCalled();
    expect(eq).toHaveBeenCalledWith("meeting_id", "meeting-1");
    expect(eq).toHaveBeenCalledWith(
      "embedding_model",
      ACTIVE_TRANSCRIPT_EMBEDDING_MODEL
    );
    expect(eq).toHaveBeenCalledWith(
      "embedding_dimensions",
      ACTIVE_TRANSCRIPT_EMBEDDING_DIMENSIONS
    );
    expect(eq).toHaveBeenCalledWith("chunking_version", TRANSCRIPT_CHUNKING_VERSION);
  });
});

describe("matchMeetingTranscriptChunks", () => {
  it("calls the scoped vector RPC with default limit and threshold", async () => {
    const data = [
      {
        id: "chunk-1",
        meeting_id: "meeting-1",
        chunk_index: 0,
        text: "Trecho",
        speaker: "A",
        start_ms: 0,
        end_ms: 1000,
        metadata: {},
        similarity: 0.84,
      },
    ];
    const rpc = vi.fn().mockResolvedValue({ data, error: null });

    const result = await matchMeetingTranscriptChunks({
      supabase: { rpc } as never,
      userId: "user-1",
      meetingId: "meeting-1",
      queryEmbedding: createEmbedding(0.25),
    });

    expect(rpc).toHaveBeenCalledWith("match_meeting_transcript_chunks", {
      p_user_id: "user-1",
      p_meeting_id: "meeting-1",
      p_query_embedding: createEmbedding(0.25),
      p_limit: 5,
      p_similarity_threshold: 0.6,
      p_embedding_model: ACTIVE_TRANSCRIPT_EMBEDDING_MODEL,
      p_embedding_dimensions: ACTIVE_TRANSCRIPT_EMBEDDING_DIMENSIONS,
      p_chunking_version: TRANSCRIPT_CHUNKING_VERSION,
    });
    expect(result).toEqual(data);
  });
});

describe("toChatSources", () => {
  it("maps matched chunks to persisted chat sources", () => {
    expect(
      toChatSources([
        {
          id: "chunk-1",
          meeting_id: "meeting-1",
          chunk_index: 0,
          text: "Trecho usado",
          speaker: "A",
          start_ms: 1000,
          end_ms: 2000,
          metadata: {},
          similarity: 0.82,
        },
      ])
    ).toEqual([
      {
        chunkId: "chunk-1",
        similarity: 0.82,
        startMs: 1000,
        endMs: 2000,
        speaker: "A",
        text: "Trecho usado",
      },
    ]);
  });
});
