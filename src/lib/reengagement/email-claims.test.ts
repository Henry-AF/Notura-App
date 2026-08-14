import { describe, expect, it, vi } from "vitest";
import {
  claimReengagementEmail,
  listReengagementCandidates,
  releaseReengagementEmailClaim,
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

  it("atomically claims a delivery with trigger and variant", async () => {
    const insert = vi.fn().mockResolvedValue({ error: null });
    const from = vi.fn(() => ({ insert }));
    const candidate = {
      userId: "user-1",
      lastMeetingAt: "2026-08-07T00:00:00.000Z",
      daysSinceLastMeeting: 3,
    };

    await expect(claimReengagementEmail(candidate, { from } as never)).resolves.toBe(true);

    expect(insert).toHaveBeenCalledWith({
      user_id: "user-1",
      trigger_type: "meeting_inactive_48h",
      variant: "functional",
      last_meeting_at: candidate.lastMeetingAt,
    });
  });

  it("returns false when the delivery was already claimed", async () => {
    const insert = vi.fn().mockResolvedValue({
      error: { code: "23505", message: "duplicate key" },
    });
    const candidate = {
      userId: "user-1",
      lastMeetingAt: "2026-08-07T00:00:00.000Z",
      daysSinceLastMeeting: 3,
    };

    await expect(
      claimReengagementEmail(candidate, { from: () => ({ insert }) } as never)
    ).resolves.toBe(false);
  });

  it("releases a claim after a definitive rejection", async () => {
    const eqLastMeeting = vi.fn().mockResolvedValue({ error: null });
    const eqTrigger = vi.fn(() => ({ eq: eqLastMeeting }));
    const eqUser = vi.fn(() => ({ eq: eqTrigger }));
    const deleteClaim = vi.fn(() => ({ eq: eqUser }));
    const candidate = {
      userId: "user-1",
      lastMeetingAt: "2026-08-07T00:00:00.000Z",
      daysSinceLastMeeting: 3,
    };

    await releaseReengagementEmailClaim(candidate, {
      from: () => ({ delete: deleteClaim }),
    } as never);

    expect(eqUser).toHaveBeenCalledWith("user_id", "user-1");
    expect(eqTrigger).toHaveBeenCalledWith("trigger_type", "meeting_inactive_48h");
    expect(eqLastMeeting).toHaveBeenCalledWith("last_meeting_at", candidate.lastMeetingAt);
  });
});
