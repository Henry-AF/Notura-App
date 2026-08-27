import { describe, expect, it } from "vitest";

import { verifyMigrationFiles } from "../scripts/migrations.mjs";

describe("Supabase migration numbering policy", () => {
  it("accepts legacy migrations and timestamped migrations", () => {
    expect(verifyMigrationFiles([
      "037_reengagement_email_claim_uniqueness.sql",
      "20260825143000_referral_tracking.sql",
    ])).toEqual([]);
  });

  it("rejects new sequential migration numbers", () => {
    expect(verifyMigrationFiles(["039_future_change.sql"])).toEqual([
      expect.stringContaining("sequential migration numbers ended at 38"),
    ]);
  });

  it("rejects duplicate timestamps", () => {
    const errors = verifyMigrationFiles([
      "20260825143000_first_change.sql",
      "20260825143000_second_change.sql",
    ]);
    expect(errors).toEqual([expect.stringContaining("version 20260825143000 is duplicated")]);
  });

  it("rejects malformed names", () => {
    expect(verifyMigrationFiles(["20260825143000-Not Valid.sql"])).toEqual([
      expect.stringContaining("YYYYMMDDHHMMSS"),
    ]);
  });
});
