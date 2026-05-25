import { beforeEach, describe, expect, it, vi } from "vitest";
import type { MeetingParticipant } from "@/types/database";
import type { GeminiMeetingParticipantDraft } from "./summary-structured";
import {
  buildParticipantUpserts,
  mapParticipantRefsToIds,
  normalizeDisplayName,
  normalizeParticipantRole,
  updateMeetingParticipantDisplayNameForUser,
} from "./participants";

const mocks = vi.hoisted(() => ({
  requireOwnership: vi.fn(),
}));

vi.mock("@/lib/api/auth", () => ({
  requireOwnership: mocks.requireOwnership,
}));

const drafts: GeminiMeetingParticipantDraft[] = [
  {
    ref: "p1",
    displayName: "Ana",
    originalName: "Speaker A",
    role: "participant",
  },
  {
    ref: "e1",
    displayName: "Acme",
    originalName: "Acme",
    role: "entity",
  },
];

const rows: MeetingParticipant[] = [
  {
    id: "participant-id",
    meeting_id: "meeting-1",
    display_name: "Ana",
    original_name: "Speaker A",
    role: "participant",
    created_at: "2026-05-23T00:00:00.000Z",
    updated_at: "2026-05-23T00:00:00.000Z",
  },
  {
    id: "entity-id",
    meeting_id: "meeting-1",
    display_name: "Acme",
    original_name: "Acme",
    role: "entity",
    created_at: "2026-05-23T00:00:00.000Z",
    updated_at: "2026-05-23T00:00:00.000Z",
  },
];

describe("meeting participant helpers", () => {
  beforeEach(() => {
    mocks.requireOwnership.mockResolvedValue(undefined);
  });

  it("normalizes display names", () => {
    expect(normalizeDisplayName("  Ana Maria  ")).toBe("Ana Maria");
  });

  it("rejects blank display names", () => {
    expect(() => normalizeDisplayName("   ")).toThrow("Nome é obrigatório.");
  });

  it("rejects display names over 80 characters", () => {
    expect(() => normalizeDisplayName("a".repeat(81))).toThrow(
      "Nome deve ter no máximo 80 caracteres."
    );
  });

  it("normalizes participant roles", () => {
    expect(normalizeParticipantRole("entity")).toBe("entity");
    expect(normalizeParticipantRole("participant")).toBe("participant");
    expect(() => normalizeParticipantRole("company")).toThrow(
      "Tipo deve ser participante ou entidade."
    );
  });

  it("builds participant upsert rows from Gemini drafts", () => {
    expect(
      buildParticipantUpserts({ meetingId: "meeting-1", participants: drafts })
    ).toEqual([
      {
        meeting_id: "meeting-1",
        display_name: "Ana",
        original_name: "Speaker A",
        role: "participant",
      },
      {
        meeting_id: "meeting-1",
        display_name: "Acme",
        original_name: "Acme",
        role: "entity",
      },
    ]);
  });

  it("maps temporary participant refs to persisted ids", () => {
    expect(mapParticipantRefsToIds(drafts, rows)).toEqual({
      p1: { id: "participant-id", role: "participant" },
      e1: { id: "entity-id", role: "entity" },
    });
  });

  it("updates a participant display name and role after checking meeting ownership", async () => {
    const update = vi.fn(() => ({
      eq: vi.fn(() => ({
        eq: vi.fn(() => ({
          select: vi.fn(() => ({
            single: vi.fn().mockResolvedValue({
              data: { ...rows[0], display_name: "Ana Nova" },
              error: null,
            }),
          })),
        })),
      })),
    }));
    const supabase = {
      from: vi.fn(() => ({ update })),
    };

    const result = await updateMeetingParticipantDisplayNameForUser({
      supabase: supabase as never,
      userId: "user-1",
      meetingId: "meeting-1",
      participantId: "participant-id",
      input: { displayName: " Ana Nova ", role: "entity", meeting_id: "other" },
    });

    expect(mocks.requireOwnership).toHaveBeenCalledWith(
      supabase,
      "meetings",
      "meeting-1",
      "user-1"
    );
    expect(update).toHaveBeenCalledWith({
      display_name: "Ana Nova",
      role: "entity",
    });
    expect(result.display_name).toBe("Ana Nova");
  });

  it("clears structured action item ownership when a participant becomes an entity", async () => {
    const meetingSummary = {
      version: 1,
      sections: [],
      action_items: [
        {
          description: "Enviar proposta",
          participant_id: "participant-id",
          due_date: null,
          priority: "média",
        },
        {
          description: "Revisar contrato",
          participant_id: "other-participant",
          due_date: null,
          priority: "média",
        },
      ],
    };
    const updateParticipant = vi.fn(() => ({
      eq: vi.fn(() => ({
        eq: vi.fn(() => ({
          select: vi.fn(() => ({
            single: vi.fn().mockResolvedValue({
              data: { ...rows[0], role: "entity" },
              error: null,
            }),
          })),
        })),
      })),
    }));
    const updateMeeting = vi.fn(() => ({
      eq: vi.fn().mockResolvedValue({ data: null, error: null }),
    }));
    const selectMeeting = vi.fn(() => ({
      eq: vi.fn(() => ({
        maybeSingle: vi.fn().mockResolvedValue({
          data: { summary_structured: meetingSummary },
          error: null,
        }),
      })),
    }));
    const supabase = {
      from: vi.fn((table: string) => {
        if (table === "meeting_participants") {
          return { update: updateParticipant };
        }
        return { select: selectMeeting, update: updateMeeting };
      }),
    };

    await updateMeetingParticipantDisplayNameForUser({
      supabase: supabase as never,
      userId: "user-1",
      meetingId: "meeting-1",
      participantId: "participant-id",
      input: { role: "entity" },
    });

    expect(updateMeeting).toHaveBeenCalledWith({
      summary_structured: {
        ...meetingSummary,
        action_items: [
          {
            description: "Enviar proposta",
            participant_id: null,
            due_date: null,
            priority: "média",
          },
          meetingSummary.action_items[1],
        ],
      },
    });
  });
});
