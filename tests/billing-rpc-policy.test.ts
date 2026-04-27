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
  it("restricts the increment function to the service role", () => {
    const sql = readMigration();
    const functionSignature =
      "public.increment_billing_meetings_this_month(uuid, integer)";

    expect(sql).toContain(`revoke all on function ${functionSignature} from public;`);
    expect(sql).toContain(`revoke all on function ${functionSignature} from anon;`);
    expect(sql).toContain(
      `revoke all on function ${functionSignature} from authenticated;`
    );
    expect(sql).toContain(`grant execute on function ${functionSignature} to service_role;`);
  });
});
