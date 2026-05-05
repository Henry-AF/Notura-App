import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const REFUND_MIGRATION_PATH =
  "supabase/migrations/015_meeting_ai_usage_refunds.sql";

function readMigration(path: string): string {
  return readFileSync(resolve(process.cwd(), path), "utf8")
    .toLowerCase()
    .replace(/\s+/g, " ");
}

describe("meeting AI usage refund policy", () => {
  it("adds an idempotent service-role refund path for failed AI chats", () => {
    const sql = readMigration(REFUND_MIGRATION_PATH);

    expect(sql).toContain("create table if not exists ai_usage_refunds");
    expect(sql).toContain("chat_id uuid not null references meeting_chats");
    expect(sql).toContain("unique (chat_id, feature)");
    expect(sql).toContain("revoke all on table ai_usage_refunds from authenticated");
    expect(sql).toContain("grant all on table ai_usage_refunds to service_role");
    expect(sql).toContain("create or replace function refund_meeting_chat_ai_usage");
    expect(sql).toContain("c.status = 'failed'");
    expect(sql).toContain("c.fallback_reason = 'provider_error'");
    expect(sql).toContain("on conflict (chat_id, feature) do nothing");
    expect(sql).toContain("used_count = greatest(public.ai_usage_daily.used_count - 1, 0)");
    expect(sql).toContain(
      "grant execute on function refund_meeting_chat_ai_usage( uuid, uuid, text, text ) to service_role"
    );
    expect(sql).not.toContain(
      "grant execute on function refund_meeting_chat_ai_usage( uuid, uuid, text, text ) to authenticated"
    );
  });
});
