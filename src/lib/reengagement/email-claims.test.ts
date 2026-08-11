import { describe, expect, it, vi } from "vitest";
import {
  listReengagementCandidates,
  markReengagementEmailSent,
} from "./email-claims";

describe("reengagement email claims", () => {
  it("maps candidates returned by the eligibility query", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: [{
        user_id: "user-1",
        last_meeting_at: "2026-08-07T00:00:00.000Z",
        days_since_last_meeting: 3,
      }],
      error: null,
    });

    await expect(listReengagementCandidates({ rpc } as never)).resolves.toEqual([{
      userId: "user-1",
      lastMeetingAt: "2026-08-07T00:00:00.000Z",
      daysSinceLastMeeting: 3,
    }]);
  });

  it("inserts the delivery claim with trigger and variant", async () => {
    const insert = vi.fn().mockResolvedValue({ error: null });
    const from = vi.fn(() => ({ insert }));
    const candidate = {
      userId: "user-1",
      lastMeetingAt: "2026-08-07T00:00:00.000Z",
      daysSinceLastMeeting: 3,
    };

    await markReengagementEmailSent(candidate, { from } as never);

    expect(insert).toHaveBeenCalledWith({
      user_id: "user-1",
      trigger_type: "meeting_inactive_48h",
      variant: "functional",
      last_meeting_at: candidate.lastMeetingAt,
    });
  });
});
