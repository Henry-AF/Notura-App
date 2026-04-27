import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function readMigration() {
  return readFileSync(
    resolve(process.cwd(), "supabase/migrations/012_atomic_increment_billing_usage.sql"),
    "utf8"
  ).replace(/\s+/g, " ");
}

describe("billing usage increment RPC policy", () => {
  it("adds quota period columns and backfills usage from historical meetings", () => {
    const sql = readMigration();

    expect(sql).toContain("add column if not exists meetings_used integer not null default 0");
    expect(sql).toContain("add column if not exists current_period_start timestamptz");
    expect(sql).toContain("add column if not exists current_period_end timestamptz");
    expect(sql).toContain("count(*)::integer as meetings_used");
    expect(sql).toContain("from public.meetings");
  });

  it("restricts quota functions to the service role", () => {
    const sql = readMigration();
    const consumeSignature = "public.consume_meeting_quota(uuid)";
    const refundSignature = "public.refund_meeting_quota(uuid)";

    expect(sql).toContain(`revoke all on function ${consumeSignature} from public;`);
    expect(sql).toContain(`revoke all on function ${consumeSignature} from anon;`);
    expect(sql).toContain(`revoke all on function ${consumeSignature} from authenticated;`);
    expect(sql).toContain(`grant execute on function ${consumeSignature} to service_role;`);
    expect(sql).toContain(`revoke all on function ${refundSignature} from public;`);
    expect(sql).toContain(`revoke all on function ${refundSignature} from anon;`);
    expect(sql).toContain(`revoke all on function ${refundSignature} from authenticated;`);
    expect(sql).toContain(`grant execute on function ${refundSignature} to service_role;`);
  });

  it("refunds quota with one database update that keeps usage columns in sync", () => {
    const sql = readMigration();

    expect(sql).toContain("create or replace function public.refund_meeting_quota(p_user_id uuid)");
    expect(sql).toContain(
      "meetings_used = greatest(public.billing_accounts.meetings_used - 1, 0)"
    );
    expect(sql).toContain(
      "meetings_this_month = greatest(public.billing_accounts.meetings_used - 1, 0)"
    );
  });
});
