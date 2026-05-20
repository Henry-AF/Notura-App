import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function readHardeningMigration() {
  return readFileSync(
    resolve(
      process.cwd(),
      "supabase/migrations/019_secure_billing_accounts_write_policies.sql"
    ),
    "utf8"
  ).replace(/\s+/g, " ");
}

describe("billing accounts RLS policy", () => {
  it("removes direct authenticated writes to billing-controlled state", () => {
    const sql = readHardeningMigration();

    expect(sql).toContain(
      'drop policy if exists "billing_accounts_own_insert" on public.billing_accounts;'
    );
    expect(sql).toContain(
      'drop policy if exists "billing_accounts_own_update" on public.billing_accounts;'
    );
    expect(sql).toContain(
      "revoke insert, update, delete on table public.billing_accounts from authenticated;"
    );
    expect(sql).toContain(
      "revoke insert, update, delete on table public.billing_accounts from anon;"
    );
  });
});
