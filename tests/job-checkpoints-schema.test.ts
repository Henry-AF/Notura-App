import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const MIGRATION_PATH = "supabase/migrations/033_job_checkpoints.sql";

function readMigration(): string {
  return readFileSync(resolve(process.cwd(), MIGRATION_PATH), "utf8")
    .toLowerCase()
    .replace(/\s+/g, " ");
}

describe("job_checkpoints schema", () => {
  it("creates the checkpoint table with the expected columns and constraints", () => {
    const sql = readMigration();

    expect(sql).toContain("create table if not exists public.job_checkpoints");
    expect(sql).toContain("id uuid primary key default gen_random_uuid()");
    expect(sql).toContain(
      "meeting_id uuid not null references public.meetings on delete cascade"
    );
    expect(sql).toContain("job_id uuid references public.jobs on delete set null");
    expect(sql).toContain(
      "user_id uuid not null references auth.users on delete cascade"
    );
    expect(sql).toContain("step_name text not null");
    expect(sql).toContain("status in ('pending', 'running', 'completed', 'failed')");
    expect(sql).toContain("payload jsonb");
    expect(sql).toContain("jsonb_typeof(payload) = 'object'");
    expect(sql).toContain("fingerprint text");
    expect(sql).toContain("attempts integer not null default 0");
    expect(sql).toContain("error text");
    expect(sql).toContain("created_at timestamptz not null default now()");
    expect(sql).toContain("updated_at timestamptz not null default now()");
    expect(sql).toContain("unique (meeting_id, step_name)");
    expect(sql).toContain("idx_job_checkpoints_job_id");
    expect(sql).toContain("idx_job_checkpoints_meeting_status");
  });

  it("locks the table down to the service role like the other pipeline tables", () => {
    const sql = readMigration();

    expect(sql).toContain(
      "alter table public.job_checkpoints enable row level security"
    );
    expect(sql).not.toContain("create policy");
    expect(sql).toContain(
      "revoke all on table public.job_checkpoints from authenticated"
    );
    expect(sql).toContain("revoke all on table public.job_checkpoints from anon");
    expect(sql).toContain(
      "grant all on table public.job_checkpoints to service_role"
    );
  });

  it("documents the rollback in the migration header", () => {
    const sql = readMigration();

    expect(sql).toContain("rollback: drop table if exists public.job_checkpoints;");
  });
});
