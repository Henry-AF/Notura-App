import { describe, expect, it } from "vitest";
import type { Database } from "../../types/database";

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
