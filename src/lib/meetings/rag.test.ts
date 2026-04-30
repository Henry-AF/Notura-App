import { describe, expect, it } from "vitest";
import type { Database } from "../../types/database";
import {
  buildTranscriptChunksFromFormattedTranscript,
  buildTranscriptChunksFromUtterances,
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

    expect(tableNames).toEqual(["meeting_transcript_chunks", "meeting_chats"]);
    expect(_chunkId).toBe("chunk-1");
    expect(_chatId).toBe("chat-1");
    expect(_limit).toBe(5);
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
});
