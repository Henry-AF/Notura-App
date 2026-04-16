import { beforeEach, describe, expect, it, vi } from "vitest";

const requireOwnership = vi.fn();
const deleteAudio = vi.fn();

vi.mock("@/lib/api/auth", () => ({
  requireOwnership,
  requireAuth: vi.fn(),
}));

vi.mock("@/lib/r2", () => ({
  deleteAudio,
}));

function createMeetingAdminClient(options?: {
  meeting?: { id: string; audio_r2_key: string | null } | null;
  selectError?: { message: string } | null;
  deleteError?: { message: string } | null;
}) {
  const maybeSingle = vi.fn().mockResolvedValue({
    data: options?.meeting ?? null,
    error: options?.selectError ?? null,
  });
  const order = vi.fn().mockReturnValue({ maybeSingle });
  const secondEq = vi.fn().mockReturnValue({ maybeSingle, order });
  const firstEq = vi.fn().mockReturnValue({ eq: secondEq, maybeSingle, order });
  const select = vi.fn().mockReturnValue({ eq: firstEq });
  const deleteEq = vi.fn().mockResolvedValue({
    error: options?.deleteError ?? null,
  });
  const remove = vi.fn().mockReturnValue({ eq: deleteEq });

  return {
    client: {
      from: vi.fn().mockReturnValue({
        select,
        delete: remove,
      }),
    },
    deleteEq,
    remove,
  };
}

describe("meeting deletion helper", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("deletes the owned meeting and its audio file", async () => {
    requireOwnership.mockResolvedValue(undefined);
    deleteAudio.mockResolvedValue(undefined);
    const { client, deleteEq } = createMeetingAdminClient({
      meeting: {
        id: "meeting-1",
        audio_r2_key: "meetings/user-1/audio.mp4",
      },
    });

    const mod = await import("./delete");
    const result = await mod.deleteMeetingForUser(
      client as never,
      "user-1",
      "meeting-1"
    );

    expect(result).toEqual({ success: true, alreadyDeleted: false });
    expect(requireOwnership).toHaveBeenCalledWith(
      client,
      "meetings",
      "meeting-1",
      "user-1"
    );
    expect(deleteAudio).toHaveBeenCalledWith("meetings/user-1/audio.mp4");
    expect(deleteEq).toHaveBeenCalledWith("id", "meeting-1");
  });

  it("returns idempotent success when the meeting is already gone", async () => {
    requireOwnership.mockRejectedValue(new Response(null, { status: 403 }));
    const { client, remove } = createMeetingAdminClient({
      meeting: null,
    });

    const mod = await import("./delete");
    const result = await mod.deleteMeetingForUser(
      client as never,
      "user-1",
      "meeting-1"
    );

    expect(result).toEqual({ success: true, alreadyDeleted: true });
    expect(deleteAudio).not.toHaveBeenCalled();
    expect(remove).not.toHaveBeenCalled();
  });

  it("stops the deletion when audio cleanup fails", async () => {
    requireOwnership.mockResolvedValue(undefined);
    deleteAudio.mockRejectedValue(new Error("R2 indisponivel"));
    const { client, remove } = createMeetingAdminClient({
      meeting: {
        id: "meeting-1",
        audio_r2_key: "meetings/user-1/audio.mp4",
      },
    });

    const mod = await import("./delete");

    await expect(
      mod.deleteMeetingForUser(client as never, "user-1", "meeting-1")
    ).rejects.toThrow("R2 indisponivel");
    expect(remove).not.toHaveBeenCalled();
  });
});
