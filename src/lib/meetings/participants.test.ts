import { beforeEach, describe, expect, it, vi } from "vitest";
import type { MeetingParticipant } from "@/types/database";
import type { GeminiMeetingParticipantDraft } from "./summary-structured";
import {
  buildParticipantUpserts,
  mergeMeetingParticipantsForUser,
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
    const selectPreviousParticipant = vi.fn(() => ({
      eq: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn().mockResolvedValue({
            data: rows[0],
            error: null,
          }),
        })),
      })),
    }));
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
    const taskOwnerIn = vi.fn().mockResolvedValue({ data: null, error: null });
    const updateTaskOwner = vi.fn(() => ({
      eq: vi.fn(() => ({
        in: taskOwnerIn,
      })),
    }));
    const supabase = {
      from: vi.fn((table: string) => {
        if (table === "meeting_participants") {
          return { select: selectPreviousParticipant, update };
        }
        return { update: updateTaskOwner };
      }),
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
    const selectPreviousParticipant = vi.fn(() => ({
      eq: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn().mockResolvedValue({
            data: rows[0],
            error: null,
          }),
        })),
      })),
    }));
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
    const taskOwnerIn = vi.fn().mockResolvedValue({ data: null, error: null });
    const updateTaskOwner = vi.fn(() => ({
      eq: vi.fn(() => ({
        in: taskOwnerIn,
      })),
    }));
    const supabase = {
      from: vi.fn((table: string) => {
        if (table === "meeting_participants") {
          return { select: selectPreviousParticipant, update: updateParticipant };
        }
        if (table === "tasks") {
          return { update: updateTaskOwner };
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

  it("updates task owners when a participant display name changes", async () => {
    const selectPreviousParticipant = vi.fn(() => ({
      eq: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn().mockResolvedValue({
            data: rows[0],
            error: null,
          }),
        })),
      })),
    }));
    const updateParticipant = vi.fn(() => ({
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
    const taskOwnerIn = vi.fn().mockResolvedValue({ data: null, error: null });
    const updateTaskOwner = vi.fn(() => ({
      eq: vi.fn(() => ({
        in: taskOwnerIn,
      })),
    }));
    const supabase = {
      from: vi.fn((table: string) => {
        if (table === "meeting_participants") {
          return { select: selectPreviousParticipant, update: updateParticipant };
        }
        return { update: updateTaskOwner };
      }),
    };

    await updateMeetingParticipantDisplayNameForUser({
      supabase: supabase as never,
      userId: "user-1",
      meetingId: "meeting-1",
      participantId: "participant-id",
      input: { displayName: "Ana Nova" },
    });

    expect(updateTaskOwner).toHaveBeenCalledWith({ owner: "Ana Nova" });
    expect(taskOwnerIn).toHaveBeenCalledWith("owner", ["Speaker A", "Ana"]);
  });

  it("clears task owners when a participant becomes an entity", async () => {
    const selectPreviousParticipant = vi.fn(() => ({
      eq: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn().mockResolvedValue({
            data: rows[0],
            error: null,
          }),
        })),
      })),
    }));
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
          data: { summary_structured: { version: 1, action_items: [] } },
          error: null,
        }),
      })),
    }));
    const taskOwnerIn = vi.fn().mockResolvedValue({ data: null, error: null });
    const updateTaskOwner = vi.fn(() => ({
      eq: vi.fn(() => ({
        in: taskOwnerIn,
      })),
    }));
    const supabase = {
      from: vi.fn((table: string) => {
        if (table === "meeting_participants") {
          return { select: selectPreviousParticipant, update: updateParticipant };
        }
        if (table === "tasks") {
          return { update: updateTaskOwner };
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

    expect(updateTaskOwner).toHaveBeenCalledWith({ owner: null });
    expect(taskOwnerIn).toHaveBeenCalledWith("owner", ["Speaker A", "Ana"]);
  });

  it("merges duplicate participants into the selected target participant", async () => {
    const source = {
      ...rows[0],
      id: "biel-id",
      display_name: "Biel",
      original_name: "Speaker B",
    };
    const target = {
      ...rows[0],
      id: "gabriel-id",
      display_name: "Gabriel",
      original_name: "Gabriel",
    };
    const meetingSummary = {
      version: 1,
      sections: [
        {
          title: "Contexto",
          content: "Biel comentou os pontos.",
          participant_ids: ["biel-id", "gabriel-id"],
        },
      ],
      action_items: [
        {
          description: "Enviar proposta",
          participant_id: "biel-id",
          due_date: null,
          priority: "média",
        },
      ],
    };
    const deleteParticipant = vi.fn(() => ({
      eq: vi.fn(() => ({
        eq: vi.fn().mockResolvedValue({ data: null, error: null }),
      })),
    }));
    const selectParticipants = vi.fn(() => ({
      eq: vi.fn(() => ({
        in: vi.fn().mockResolvedValue({ data: [source, target], error: null }),
      })),
    }));
    const selectMeeting = vi.fn(() => ({
      eq: vi.fn(() => ({
        maybeSingle: vi.fn().mockResolvedValue({
          data: {
            summary_structured: meetingSummary,
            summary_whatsapp:
              "Reunião: Teste\nParticipantes: Biel, Gabriel\n\nDecisões tomadas:\n• Biel falou com Gabriel.",
          },
          error: null,
        }),
      })),
    }));
    const updateMeeting = vi.fn(() => ({
      eq: vi.fn().mockResolvedValue({ data: null, error: null }),
    }));
    const taskOwnerIn = vi.fn().mockResolvedValue({ data: null, error: null });
    const updateTaskOwner = vi.fn(() => ({
      eq: vi.fn(() => ({
        in: taskOwnerIn,
      })),
    }));
    const supabase = {
      from: vi.fn((table: string) => {
        if (table === "meeting_participants") {
          return { select: selectParticipants, delete: deleteParticipant };
        }
        if (table === "tasks") {
          return { update: updateTaskOwner };
        }
        return { select: selectMeeting, update: updateMeeting };
      }),
    };

    const result = await mergeMeetingParticipantsForUser({
      supabase: supabase as never,
      userId: "user-1",
      meetingId: "meeting-1",
      sourceParticipantId: "biel-id",
      targetParticipantId: "gabriel-id",
    });

    expect(result).toEqual(target);
    expect(mocks.requireOwnership).toHaveBeenCalledWith(
      supabase,
      "meetings",
      "meeting-1",
      "user-1"
    );
    expect(updateMeeting).toHaveBeenCalledWith({
      summary_structured: {
        ...meetingSummary,
        sections: [
          {
            ...meetingSummary.sections[0],
            participant_ids: ["gabriel-id"],
          },
        ],
        action_items: [
          {
            ...meetingSummary.action_items[0],
            participant_id: "gabriel-id",
          },
        ],
      },
      summary_whatsapp:
        "Reunião: Teste\nParticipantes: Gabriel\n\nDecisões tomadas:\n• Gabriel falou com Gabriel.",
    });
    expect(updateTaskOwner).toHaveBeenCalledWith({ owner: "Gabriel" });
    expect(taskOwnerIn).toHaveBeenCalledWith("owner", ["Speaker B", "Biel"]);
    expect(deleteParticipant).toHaveBeenCalled();
  });

  it("does not update task owners or delete the source participant when summary loading fails during merge", async () => {
    const source = {
      ...rows[0],
      id: "biel-id",
      display_name: "Biel",
      original_name: "Speaker B",
    };
    const target = {
      ...rows[0],
      id: "gabriel-id",
      display_name: "Gabriel",
      original_name: "Gabriel",
    };
    const deleteParticipant = vi.fn(() => ({
      eq: vi.fn(() => ({
        eq: vi.fn().mockResolvedValue({ data: null, error: null }),
      })),
    }));
    const selectParticipants = vi.fn(() => ({
      eq: vi.fn(() => ({
        in: vi.fn().mockResolvedValue({ data: [source, target], error: null }),
      })),
    }));
    const selectMeeting = vi.fn(() => ({
      eq: vi.fn(() => ({
        maybeSingle: vi.fn().mockResolvedValue({
          data: null,
          error: { message: "database unavailable" },
        }),
      })),
    }));
    const updateTaskOwner = vi.fn(() => ({
      eq: vi.fn(() => ({
        in: vi.fn().mockResolvedValue({ data: null, error: null }),
      })),
    }));
    const supabase = {
      from: vi.fn((table: string) => {
        if (table === "meeting_participants") {
          return { select: selectParticipants, delete: deleteParticipant };
        }
        if (table === "tasks") {
          return { update: updateTaskOwner };
        }
        return { select: selectMeeting };
      }),
    };

    await expect(
      mergeMeetingParticipantsForUser({
        supabase: supabase as never,
        userId: "user-1",
        meetingId: "meeting-1",
        sourceParticipantId: "biel-id",
        targetParticipantId: "gabriel-id",
      })
    ).rejects.toThrow(
      "Failed to load meeting summary before participant merge: database unavailable"
    );
    expect(updateTaskOwner).not.toHaveBeenCalled();
    expect(deleteParticipant).not.toHaveBeenCalled();
  });

  it("rejects merging participants with different roles", async () => {
    const selectParticipants = vi.fn(() => ({
      eq: vi.fn(() => ({
        in: vi.fn().mockResolvedValue({
          data: [
            { ...rows[0], id: "participant-id", role: "participant" },
            { ...rows[1], id: "entity-id", role: "entity" },
          ],
          error: null,
        }),
      })),
    }));
    const supabase = {
      from: vi.fn(() => ({ select: selectParticipants })),
    };

    await expect(
      mergeMeetingParticipantsForUser({
        supabase: supabase as never,
        userId: "user-1",
        meetingId: "meeting-1",
        sourceParticipantId: "participant-id",
        targetParticipantId: "entity-id",
      })
    ).rejects.toThrow("Só é possível mesclar itens do mesmo tipo.");
  });
});
