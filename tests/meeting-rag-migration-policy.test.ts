import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const MIGRATION_PATH = "supabase/migrations/013_meeting_rag_chat.sql";

function readMigration(): string {
  return readFileSync(resolve(process.cwd(), MIGRATION_PATH), "utf8")
    .toLowerCase()
    .replace(/\s+/g, " ");
}

describe("meeting RAG migration policy", () => {
  it("creates vector-backed transcript chunks and chats with HNSW search", () => {
    const sql = readMigration();

    expect(sql).toContain("create extension if not exists vector");
    expect(sql).toContain("embedding vector(768)");
    expect(sql).toContain("question_embedding vector(768)");
    expect(sql).toContain("using hnsw");
    expect(sql).toContain("vector_cosine_ops");
    expect(sql).toContain("p_limit integer default 5");
    expect(sql).toContain(
      "p_similarity_threshold double precision default 0.6"
    );
    expect(sql).toContain(
      "alter table meeting_transcript_chunks enable row level security"
    );
    expect(sql).toContain("alter table meeting_chats enable row level security");
  });
});
