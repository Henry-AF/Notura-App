import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  MeetingParticipantAccessError: class MeetingParticipantAccessError extends Error {},
  MeetingParticipantValidationError: class MeetingParticipantValidationError extends Error {},
  listMeetingParticipantsForUser: vi.fn(),
  requireOwnership: vi.fn(),
  updateMeetingParticipantDisplayNameForUser: vi.fn(),
  withAuthRateLimit: vi.fn((_policy, handler) => {
    return (request: Request, context: { params: { id: string } }) =>
      handler(request, {
        ...context,
        auth: {
          user: { id: "user-1" },
          supabaseAdmin: { from: vi.fn() },
        },
      });
  }),
}));

vi.mock("@/lib/api/auth", () => ({
  requireOwnership: mocks.requireOwnership,
}));

vi.mock("@/lib/api/rate-limit-route", () => ({
  withAuthRateLimit: mocks.withAuthRateLimit,
}));

vi.mock("@/lib/meetings/participants", () => ({
  MeetingParticipantAccessError: mocks.MeetingParticipantAccessError,
  MeetingParticipantValidationError: mocks.MeetingParticipantValidationError,
  listMeetingParticipantsForUser: mocks.listMeetingParticipantsForUser,
  updateMeetingParticipantDisplayNameForUser:
    mocks.updateMeetingParticipantDisplayNameForUser,
}));

describe("GET /api/meetings/[id]/participants", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    mocks.requireOwnership.mockResolvedValue(undefined);
    mocks.listMeetingParticipantsForUser.mockResolvedValue([
      {
        id: "participant-1",
        meeting_id: "meeting-1",
        display_name: "Ana",
        original_name: "Speaker A",
        role: "participant",
        created_at: "2026-05-23T00:00:00.000Z",
        updated_at: "2026-05-23T00:00:00.000Z",
      },
      {
        id: "entity-1",
        meeting_id: "meeting-1",
        display_name: "Acme",
        original_name: "Acme",
        role: "entity",
        created_at: "2026-05-23T00:00:00.000Z",
        updated_at: "2026-05-23T00:00:00.000Z",
      },
    ]);
  });

  it("returns 403 when the meeting does not belong to the user", async () => {
    mocks.requireOwnership.mockRejectedValueOnce(
      Response.json({ error: "Acesso negado." }, { status: 403 })
    );

    const mod = await import("./route");
    const response = await mod.GET(new Request("http://localhost") as NextRequest, {
      params: { id: "meeting-1" },
    });

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: "Acesso negado." });
    expect(mocks.listMeetingParticipantsForUser).not.toHaveBeenCalled();
  });

  it("returns participants and entities for an owned meeting", async () => {
    const mod = await import("./route");
    const response = await mod.GET(new Request("http://localhost") as NextRequest, {
      params: { id: "meeting-1" },
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      participants: [
        {
          id: "participant-1",
          displayName: "Ana",
          originalName: "Speaker A",
          role: "participant",
        },
      ],
      entities: [
        {
          id: "entity-1",
          displayName: "Acme",
          originalName: "Acme",
          role: "entity",
        },
      ],
    });
    expect(mocks.withAuthRateLimit).toHaveBeenCalled();
  });
});

describe("PATCH /api/meetings/[id]/participants", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    mocks.requireOwnership.mockResolvedValue(undefined);
    mocks.listMeetingParticipantsForUser.mockResolvedValue([]);
    mocks.updateMeetingParticipantDisplayNameForUser.mockResolvedValue({
      id: "participant-1",
      meeting_id: "meeting-1",
      display_name: "Ana Nova",
      original_name: "Speaker A",
      role: "entity",
      created_at: "2026-05-23T00:00:00.000Z",
      updated_at: "2026-05-23T00:10:00.000Z",
    });
  });

  it("updates whitelisted display name and role for a participant id sent in the body", async () => {
    const mod = await import("./route");
    const response = await mod.PATCH(
      new Request("http://localhost", {
        method: "PATCH",
        body: JSON.stringify({
          participantId: "participant-1",
          displayName: "Ana Nova",
          role: "entity",
        }),
      }) as NextRequest,
      { params: { id: "meeting-1" } }
    );

    expect(response.status).toBe(200);
    expect(mocks.updateMeetingParticipantDisplayNameForUser).toHaveBeenCalledWith({
      supabase: expect.any(Object),
      userId: "user-1",
      meetingId: "meeting-1",
      participantId: "participant-1",
      input: { displayName: "Ana Nova", role: "entity" },
    });
    expect(await response.json()).toEqual({
      participant: {
        id: "participant-1",
        displayName: "Ana Nova",
        originalName: "Speaker A",
        role: "entity",
      },
    });
  });
});
