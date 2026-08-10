import { describe, expect, it, vi } from "vitest";
import {
  hasTrialEmailEventBeenSent,
  markTrialEmailEventSent,
} from "./trial-email-claims";

function createBillingClient(data: Record<string, unknown> | null, error: Error | null = null) {
  const maybeSingle = vi.fn().mockResolvedValue({ data, error });
  const select = vi.fn().mockReturnValue({ maybeSingle });
  const is = vi.fn().mockReturnValue({ select });
  const eq = vi.fn().mockReturnValue({ is });
  const update = vi.fn().mockReturnValue({ eq });
  const from = vi.fn().mockReturnValue({ update });
  return { from, update, eq, is, select, maybeSingle };
}

describe("claimTrialEmailEvent", () => {
  it("filters by user_id and the claim column being null (atomic claim shape)", async () => {
    const client = createBillingClient({ user_id: "user-1" });

    const claimed = await markTrialEmailEventSent(
      "user-1",
      "trial_started_email_event_at",
      client as never
    );

    expect(client.from).toHaveBeenCalledWith("billing_accounts");
    expect(client.eq).toHaveBeenCalledWith("user_id", "user-1");
    expect(client.is).toHaveBeenCalledWith("trial_started_email_event_at", null);
    expect(claimed).toBe(true);
  });

  it("returns false (does not claim) when the row was already claimed — 0 rows affected", async () => {
    const client = createBillingClient(null, null);

    const claimed = await markTrialEmailEventSent(
      "user-1",
      "trial_started_email_event_at",
      client as never
    );

    expect(claimed).toBe(false);
  });

  it("throws (does not silently return false) when the database itself errors", async () => {
    const client = createBillingClient(null, new Error("connection reset"));

    await expect(
      markTrialEmailEventSent("user-1", "trial_started_email_event_at", client as never)
    ).rejects.toThrow("Failed to mark trial email event as sent: connection reset");
  });
});

describe("hasTrialEmailEventBeenSent", () => {
  function createReadClient(value: string | null, error: Error | null = null) {
    const maybeSingle = vi.fn().mockResolvedValue({
      data: value === null ? { trial_started_email_event_at: null } : { trial_started_email_event_at: value },
      error,
    });
    const eq = vi.fn().mockReturnValue({ maybeSingle });
    const select = vi.fn().mockReturnValue({ eq });
    const from = vi.fn().mockReturnValue({ select });
    return { from, select, eq, maybeSingle };
  }

  it.each([
    [null, false],
    ["2026-08-06T00:00:00.000Z", true],
  ])("maps stored status %s to sent=%s", async (value, expected) => {
    const client = createReadClient(value);

    await expect(
      hasTrialEmailEventBeenSent("user-1", "trial_started_email_event_at", client as never)
    ).resolves.toBe(expected);
  });
});
