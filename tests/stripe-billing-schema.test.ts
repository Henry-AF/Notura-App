import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function readMigration() {
  return readFileSync(
    resolve(process.cwd(), "supabase/migrations/018_stripe_billing_gateway.sql"),
    "utf8"
  ).replace(/\s+/g, " ");
}

function readDatabaseTypes() {
  return readFileSync(resolve(process.cwd(), "src/types/database.ts"), "utf8");
}

function readBillingCycleMigration() {
  return readFileSync(
    resolve(process.cwd(), "supabase/migrations/022_billing_cycle.sql"),
    "utf8"
  ).replace(/\s+/g, " ");
}

describe("Stripe billing gateway schema", () => {
  it("stores Stripe subscription and renewal state on billing accounts", () => {
    const sql = readMigration();

    expect(sql).toContain("add column if not exists stripe_subscription_id text");
    expect(sql).toContain(
      "add column if not exists stripe_auto_renew_enabled boolean not null default true"
    );
    expect(sql).toContain("add column if not exists stripe_auto_renew_updated_at timestamptz");
    expect(sql).toContain(
      "add column if not exists stripe_renewal_status text not null default 'idle'"
    );
  });

  it("keeps generated database types aligned with Stripe billing columns", () => {
    const types = readDatabaseTypes();

    expect(types).toContain("stripe_subscription_id: string | null");
    expect(types).toContain("stripe_auto_renew_enabled: boolean");
    expect(types).toContain("stripe_auto_renew_updated_at: string | null");
    expect(types).toContain("stripe_renewal_status: string");
  });

  it("persists billing cycle on billing accounts", () => {
    const sql = readBillingCycleMigration();
    const types = readDatabaseTypes();

    expect(sql).toContain("add column if not exists billing_cycle text");
    expect(sql).toContain("billing_cycle in ('monthly', 'yearly')");
    expect(types).toContain("billing_cycle: string | null");
  });

  it("separates paid subscription validity from the monthly quota window", () => {
    const sql = readBillingCycleMigration();
    const types = readDatabaseTypes();

    expect(sql).toContain("add column if not exists quota_period_start timestamptz");
    expect(sql).toContain("add column if not exists quota_period_end timestamptz");
    expect(sql).toContain("account.billing_cycle = 'yearly'");
    expect(sql).toContain("meetings_used = 0");
    expect(sql).toContain("quota_period_end <= now()");
    expect(types).toContain("quota_period_start: string | null");
    expect(types).toContain("quota_period_end: string | null");
  });
});
