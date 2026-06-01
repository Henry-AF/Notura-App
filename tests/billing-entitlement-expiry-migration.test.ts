import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function readMigration() {
  return readFileSync(
    resolve(process.cwd(), "supabase/migrations/026_billing_entitlement_expiry.sql"),
    "utf8"
  ).replace(/\s+/g, " ");
}

describe("billing entitlement expiry migration", () => {
  it("caps AbacatePay retry grace in the quota RPC", () => {
    const sql = readMigration();

    expect(sql).toContain("create or replace function public.consume_meeting_quota");
    expect(sql).toContain("account.current_period_end + interval '72 hours' > now()");
    expect(sql).toContain("account.abacatepay_renewal_status = 'retrying'");
  });
});
