import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const MIGRATION_PATH =
  "supabase/migrations/025_repair_meeting_participants_schema.sql";

function readMigration(): string {
  return readFileSync(resolve(process.cwd(), MIGRATION_PATH), "utf8")
    .toLowerCase()
    .replace(/\s+/g, " ");
}

describe("meeting participants repair migration", () => {
  it("is safe to run after a partial legacy meeting_participants migration", () => {
    const sql = readMigration();

    expect(sql).toContain("create table if not exists public.meeting_participants");
    expect(sql).toContain("add column if not exists role text");
    expect(sql).toContain("set role = 'participant'");
    expect(sql).toContain("alter column role set not null");
    expect(sql).toContain("drop constraint if exists meeting_participants_meeting_original_uniq");
    expect(sql).toContain("add constraint meeting_participants_unique_original_name");
    expect(sql).toContain('drop policy if exists "users manage own meeting participants"');
    expect(sql).toContain('drop policy if exists "meeting_participants_own_select"');
    expect(sql).toContain("notify pgrst, 'reload schema'");
  });
});
