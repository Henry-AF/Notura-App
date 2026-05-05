import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const INITIAL_MIGRATION_PATH = "supabase/migrations/013_meeting_rag_chat.sql";
const QUOTA_MIGRATION_PATH =
  "supabase/migrations/016_meeting_ai_usage_quota.sql";

function readMigration(path: string): string {
  return readFileSync(resolve(process.cwd(), path), "utf8")
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function expectAiUsageQuota(sql: string): void {
  expect(sql).toContain("create table if not exists ai_usage_daily");
  expect(sql).toContain("feature text not null");
  expect(sql).toContain("usage_date date not null");
  expect(sql).toContain("used_count integer not null default 0");
  expect(sql).toContain("quota_limit integer not null");
  expect(sql).toContain("primary key (user_id, usage_date, feature)");
  expect(sql).toContain("revoke all on table ai_usage_daily from authenticated");
  expect(sql).toContain("grant all on table ai_usage_daily to service_role");
  expect(sql).toContain("p_ai_feature text default 'meeting_chat'");
  expect(sql).toContain("p_ai_daily_quota_limit integer default 10");
  expect(sql).toContain("update public.ai_usage_daily");
  expect(sql).toContain("used_count = public.ai_usage_daily.used_count + 1");
  expect(sql).toContain("used_count < p_ai_daily_quota_limit");
  expect(sql).toContain(
    "raise exception 'ai_chat_daily_quota_exceeded' using errcode = 'ai001'"
  );
  expect(sql).toContain(
    "grant execute on function create_meeting_chat_with_outbox( uuid, uuid, text, text, integer ) to service_role"
  );
  expect(sql).not.toContain(
    "grant execute on function create_meeting_chat_with_outbox( uuid, uuid, text, text, integer ) to authenticated"
  );
}

describe("meeting AI usage quota policy", () => {
  it("creates daily AI usage quota infrastructure in the initial migration", () => {
    expectAiUsageQuota(readMigration(INITIAL_MIGRATION_PATH));
  });

  it("ships an online migration for databases that already have meeting chat", () => {
    expectAiUsageQuota(readMigration(QUOTA_MIGRATION_PATH));
  });
});
