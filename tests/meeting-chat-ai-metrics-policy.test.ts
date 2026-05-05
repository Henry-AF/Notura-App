import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const METRICS_MIGRATION_PATH =
  "supabase/migrations/014_meeting_chat_ai_metrics.sql";

function readMigration(path: string): string {
  return readFileSync(resolve(process.cwd(), path), "utf8")
    .toLowerCase()
    .replace(/\s+/g, " ");
}

describe("meeting chat AI metrics policy", () => {
  it("creates an append-only service-role metrics table for AI chat telemetry", () => {
    const sql = readMigration(METRICS_MIGRATION_PATH);

    expect(sql).toContain("create table if not exists meeting_chat_ai_metrics");
    expect(sql).toContain("chat_id uuid not null references meeting_chats");
    expect(sql).toContain("meeting_id uuid not null references meetings");
    expect(sql).toContain("user_id uuid not null references auth.users");
    expect(sql).toContain("status text not null");
    expect(sql).toContain("fallback_reason text");
    expect(sql).toContain("embedding_model text not null");
    expect(sql).toContain("answer_model text not null");
    expect(sql).toContain("retrieved_chunks_count integer not null");
    expect(sql).toContain("max_similarity double precision");
    expect(sql).toContain("avg_similarity double precision");
    expect(sql).toContain("question_tokens_estimated integer not null");
    expect(sql).toContain("context_tokens_estimated integer not null");
    expect(sql).toContain("answer_tokens_estimated integer not null");
    expect(sql).toContain("embedding_duration_ms integer");
    expect(sql).toContain("retrieval_duration_ms integer");
    expect(sql).toContain("generation_duration_ms integer");
    expect(sql).toContain("total_duration_ms integer not null");
    expect(sql).toContain("estimated_cost_usd numeric");
    expect(sql).toContain("alter table meeting_chat_ai_metrics enable row level security");
    expect(sql).toContain("revoke all on table meeting_chat_ai_metrics from authenticated");
    expect(sql).toContain("revoke all on table meeting_chat_ai_metrics from anon");
    expect(sql).toContain("revoke all on table meeting_chat_ai_metrics from public");
    expect(sql).toContain("grant all on table meeting_chat_ai_metrics to service_role");
  });
});
