import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const MIGRATION_PATH =
  "supabase/migrations/023_meeting_participants_summary_structured.sql";

function readMigration(): string {
  return readFileSync(resolve(process.cwd(), MIGRATION_PATH), "utf8")
    .toLowerCase()
    .replace(/\s+/g, " ");
}

describe("meeting participants schema", () => {
  it("creates editable meeting participants and structured summary columns", () => {
    const sql = readMigration();

    expect(sql).toContain("create table if not exists public.meeting_participants");
    expect(sql).toContain("id uuid primary key default gen_random_uuid()");
    expect(sql).toContain(
      "meeting_id uuid not null references public.meetings(id) on delete cascade"
    );
    expect(sql).toContain("display_name text not null");
    expect(sql).toContain("original_name text not null");
    expect(sql).toContain("role text not null");
    expect(sql).toContain("role in ('participant', 'entity')");
    expect(sql).toContain("summary_structured jsonb");
    expect(sql).toContain("summary_version integer not null default 1");
    expect(sql).toContain("unique (meeting_id, role, original_name)");
    expect(sql).toContain("idx_meeting_participants_meeting_id");
    expect(sql).toContain("idx_meeting_participants_meeting_role");
  });

  it("protects meeting participants with owner-scoped RLS policies", () => {
    const sql = readMigration();

    expect(sql).toContain(
      "alter table public.meeting_participants enable row level security"
    );
    expect(sql).toContain('drop policy if exists "users manage own meeting participants"');
    expect(sql).toContain("meeting_participants_own_select");
    expect(sql).toContain("meeting_participants_own_insert");
    expect(sql).toContain("meeting_participants_own_update");
    expect(sql).toContain("meeting_participants_own_delete");
    expect(sql).toContain("meetings.user_id = auth.uid()");
    expect(sql).toContain(
      "grant select, insert, update, delete on public.meeting_participants to authenticated"
    );
  });

  it("upgrades legacy meeting_participants tables created without role", () => {
    const sql = readMigration();

    expect(sql).toContain("add column if not exists role text");
    expect(sql).toContain("set role = 'participant'");
    expect(sql).toContain("alter column role set not null");
    expect(sql).toContain("alter column user_id drop not null");
    expect(sql).toContain(
      "drop constraint if exists meeting_participants_meeting_original_uniq"
    );
    expect(sql).toContain("add constraint meeting_participants_unique_original_name");
    expect(sql).toContain("notify pgrst, 'reload schema'");
  });
});
