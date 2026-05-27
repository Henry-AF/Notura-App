import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";

const mocks = vi.hoisted(() => {
  class MeetingParticipantValidationError extends Error {}

  return {
    MeetingParticipantValidationError,
    requireOwnership: vi.fn(),
    updateMeetingParticipantDisplayNameForUser: vi.fn(),
    withAuthRateLimit: vi.fn((_policy, handler) => {
      return (
        request: Request,
        context: { params: { id: string; participantId: string } }
      ) =>
        handler(request, {
          ...context,
          auth: {
            user: { id: "user-1" },
            supabaseAdmin: { from: vi.fn() },
          },
        });
    }),
  };
});

vi.mock("@/lib/api/auth", () => ({
  requireOwnership: mocks.requireOwnership,
}));

vi.mock("@/lib/api/rate-limit-route", () => ({
  withAuthRateLimit: mocks.withAuthRateLimit,
}));

vi.mock("@/lib/meetings/participants", () => ({
  MeetingParticipantValidationError: mocks.MeetingParticipantValidationError,
  updateMeetingParticipantDisplayNameForUser:
    mocks.updateMeetingParticipantDisplayNameForUser,
}));

function patchRequest(body: unknown): NextRequest {
  return new Request("http://localhost", {
    method: "PATCH",
    body: typeof body === "string" ? body : JSON.stringify(body),
  }) as NextRequest;
}

describe("PATCH /api/meetings/[id]/participants/[participantId]", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    mocks.requireOwnership.mockResolvedValue(undefined);
    mocks.updateMeetingParticipantDisplayNameForUser.mockResolvedValue({
      id: "participant-1",
      meeting_id: "meeting-1",
      display_name: "Ana Nova",
      original_name: "Speaker A",
      role: "participant",
      created_at: "2026-05-23T00:00:00.000Z",
      updated_at: "2026-05-23T00:10:00.000Z",
    });
  });

  it("returns 403 when the meeting does not belong to the user", async () => {
    mocks.requireOwnership.mockRejectedValueOnce(
      Response.json({ error: "Acesso negado." }, { status: 403 })
    );

    const mod = await import("./route");
    const response = await mod.PATCH(patchRequest({ displayName: "Ana" }), {
      params: { id: "meeting-1", participantId: "participant-1" },
    });

    expect(response.status).toBe(403);
    expect(mocks.updateMeetingParticipantDisplayNameForUser).not.toHaveBeenCalled();
  });

  it("returns 403 when the participant is not scoped to the meeting", async () => {
    mocks.updateMeetingParticipantDisplayNameForUser.mockRejectedValueOnce(
      Response.json({ error: "Acesso negado." }, { status: 403 })
    );

    const mod = await import("./route");
    const response = await mod.PATCH(patchRequest({ displayName: "Ana" }), {
      params: { id: "meeting-1", participantId: "other-participant" },
    });

    expect(response.status).toBe(403);
  });

  it("returns 400 for invalid JSON", async () => {
    const mod = await import("./route");
    const response = await mod.PATCH(patchRequest("{"), {
      params: { id: "meeting-1", participantId: "participant-1" },
    });

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Body JSON inválido." });
  });

  it("returns 400 for blank display names", async () => {
    mocks.updateMeetingParticipantDisplayNameForUser.mockRejectedValueOnce(
      new mocks.MeetingParticipantValidationError("Nome é obrigatório.")
    );

    const mod = await import("./route");
    const response = await mod.PATCH(patchRequest({ displayName: "   " }), {
      params: { id: "meeting-1", participantId: "participant-1" },
    });

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Nome é obrigatório." });
  });

  it("returns 400 for over-80-character display names", async () => {
    mocks.updateMeetingParticipantDisplayNameForUser.mockRejectedValueOnce(
      new mocks.MeetingParticipantValidationError(
        "Nome deve ter no máximo 80 caracteres."
      )
    );

    const mod = await import("./route");
    const response = await mod.PATCH(
      patchRequest({ displayName: "a".repeat(81) }),
      { params: { id: "meeting-1", participantId: "participant-1" } }
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: "Nome deve ter no máximo 80 caracteres.",
    });
  });

  it("updates whitelisted display name and role", async () => {
    const mod = await import("./route");
    const response = await mod.PATCH(
      patchRequest({
        displayName: "Ana Nova",
        role: "entity",
        original_name: "Changed",
        meeting_id: "other-meeting",
      }),
      { params: { id: "meeting-1", participantId: "participant-1" } }
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
        role: "participant",
      },
    });
  });
});
