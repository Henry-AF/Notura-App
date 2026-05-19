import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function readMigration() {
  return readFileSync(
    resolve(
      process.cwd(),
      "supabase/migrations/020_active_billing_provider.sql"
    ),
    "utf8"
  ).replace(/\s+/g, " ");
}

function readPendingCheckoutMigration() {
  return readFileSync(
    resolve(
      process.cwd(),
      "supabase/migrations/021_pending_stripe_checkout_sessions.sql"
    ),
    "utf8"
  ).replace(/\s+/g, " ");
}

describe("active billing provider migration", () => {
  it("adds an explicit provider marker for cross-gateway safety", () => {
    const sql = readMigration();

    expect(sql).toContain(
      "add column if not exists active_billing_provider text"
    );
    expect(sql).toContain("active_billing_provider in ('stripe', 'abacatepay')");
    expect(sql).toContain("stripe_subscription_id is not null then 'stripe'");
    expect(sql).toContain(
      "abacatepay_subscription_id is not null then 'abacatepay'"
    );
  });

  it("tracks pending Stripe checkout sessions so stale sessions can be expired", () => {
    const sql = readPendingCheckoutMigration();

    expect(sql).toContain("add column if not exists stripe_pending_checkout_session_id text");
    expect(sql).toContain("add column if not exists stripe_pending_plan text");
    expect(sql).toContain("stripe_pending_plan in ('pro', 'team')");
  });
});
