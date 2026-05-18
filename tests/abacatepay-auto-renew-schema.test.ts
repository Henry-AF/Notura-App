import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function readMigration() {
  return readFileSync(
    resolve(process.cwd(), "supabase/migrations/016_abacatepay_auto_renew.sql"),
    "utf8"
  ).replace(/\s+/g, " ");
}

describe("AbacatePay auto-renew schema", () => {
  it("stores Notura-managed renewal state on billing accounts", () => {
    const sql = readMigration();

    expect(sql).toContain("add column if not exists abacatepay_subscription_id text");
    expect(sql).toContain(
      "add column if not exists abacatepay_auto_renew_enabled boolean not null default true"
    );
    expect(sql).toContain("add column if not exists abacatepay_auto_renew_updated_at timestamptz");
    expect(sql).toContain(
      "add column if not exists abacatepay_renewal_attempts integer not null default 0"
    );
    expect(sql).toContain(
      "add column if not exists abacatepay_renewal_status text not null default 'idle'"
    );
    expect(sql).toContain("add column if not exists abacatepay_next_renewal_attempt_at timestamptz");
    expect(sql).toContain("add column if not exists abacatepay_last_renewal_error text");
    expect(sql).toContain("add column if not exists abacatepay_renewal_period_end timestamptz");
  });

  it("creates renewal constraints idempotently", () => {
    const sql = readMigration();

    expect(sql).toContain("from pg_constraint");
    expect(sql).toContain(
      "conname = 'billing_accounts_abacatepay_renewal_attempts_nonnegative'"
    );
    expect(sql).toContain(
      "conname = 'billing_accounts_abacatepay_renewal_status_check'"
    );
  });

  it("keeps quota consumption open during AbacatePay renewal retry grace", () => {
    const sql = readMigration();

    expect(sql).toContain("create or replace function public.consume_meeting_quota");
    expect(sql).toContain("billing_accounts.abacatepay_auto_renew_enabled");
    expect(sql).toContain("billing_accounts.abacatepay_renewal_status");
    expect(sql).toContain(
      "not ( account.abacatepay_auto_renew_enabled is true and account.abacatepay_renewal_status = 'retrying' )"
    );
  });
});
