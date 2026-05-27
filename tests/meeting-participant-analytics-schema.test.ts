import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const MIGRATION_PATH =
  "supabase/migrations/024_meeting_participant_analytics.sql";

function readMigration(): string {
  return readFileSync(resolve(process.cwd(), MIGRATION_PATH), "utf8")
    .toLowerCase()
    .replace(/\s+/g, " ");
}

describe("meeting participant analytics schema", () => {
  it("creates owner-scoped Supabase views for participant and entity analytics", () => {
    const sql = readMigration();

    expect(sql).toContain("create or replace view public.meeting_participation_analytics");
    expect(sql).toContain("create or replace view public.meeting_tasks_by_responsible");
    expect(sql).toContain("create or replace view public.meetings_by_participant");
    expect(sql).toContain("create or replace view public.meeting_entity_frequency");
    expect(sql).toContain("security_invoker = true");
    expect(sql).toContain("summary_structured");
    expect(sql).toContain("jsonb_array_elements");
    expect(sql).toContain("grant select on public.meeting_participation_analytics to authenticated");
    expect(sql).toContain("grant select on public.meeting_tasks_by_responsible to authenticated");
    expect(sql).toContain("grant select on public.meetings_by_participant to authenticated");
    expect(sql).toContain("grant select on public.meeting_entity_frequency to authenticated");
  });
});
