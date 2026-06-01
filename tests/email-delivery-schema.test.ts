import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

function readText(path: string) {
  return readFileSync(path, "utf8");
}

describe("email delivery schema", () => {
  it("stores idempotent email delivery records keyed by user and campaign", () => {
    const sql = readText("supabase/migrations/026_email_deliveries.sql");

    expect(sql).toContain("create table if not exists public.email_deliveries");
    expect(sql).toContain("user_id uuid not null references auth.users(id) on delete cascade");
    expect(sql).toContain("email_type text not null");
    expect(sql).toContain("campaign text not null");
    expect(sql).toContain("resend_email_id text");
    expect(sql).toContain("unique (user_id, email_type, campaign)");
    expect(sql).toContain("alter table public.email_deliveries enable row level security");
    expect(sql).toContain("email_deliveries_service_role_all");
  });

  it("adds email_deliveries to generated database types", () => {
    const types = readText("src/types/database.ts");

    expect(types).toContain("email_deliveries: {");
    expect(types).toContain("email_type: string");
    expect(types).toContain("campaign: string");
    expect(types).toContain("resend_email_id: string | null");
    expect(types).toContain(
      'export type EmailDelivery = Database["public"]["Tables"]["email_deliveries"]["Row"]'
    );
  });
});
