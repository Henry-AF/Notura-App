import type { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const createServerSupabase = vi.fn();
const createServiceRoleClient = vi.fn();
const inngestSend = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createServerSupabase,
  createServiceRoleClient,
}));

vi.mock("@/lib/inngest", () => ({
  inngest: {
    send: inngestSend,
  },
}));

function createServerClient(user: { id: string } | null) {
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user },
        error: null,
      }),
    },
  };
}

function createRetryAdminClient(meetingStatus: "pending" | "processing" | "failed" | "completed") {
  const maybeSingle = vi.fn().mockResolvedValue({
    data: { id: "meeting-1", user_id: "user-1" },
    error: null,
  });

  const single = vi.fn().mockResolvedValue({
    data: {
      id: "meeting-1",
      user_id: "user-1",
      audio_r2_key: "meetings/user-1/audio.mp3",
      whatsapp_number: "5511999999999",
      status: meetingStatus,
    },
    error: null,
  });

  const eq = vi.fn().mockReturnValue({ maybeSingle, single });
  const select = vi.fn().mockReturnValue({ eq });

  const updateEq = vi.fn().mockResolvedValue({ error: null });
  const update = vi.fn().mockReturnValue({ eq: updateEq });

  const from = vi.fn().mockReturnValue({ select, update });

  return {
    from,
    update,
  };
}

describe("POST /api/meetings/[id]/retry", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();

    createServerSupabase.mockReturnValue(createServerClient({ id: "user-1" }));
    inngestSend.mockResolvedValue(undefined);
  });

  it("returns 409 when meeting is pending to avoid duplicate queueing", async () => {
    createServiceRoleClient.mockReturnValue(createRetryAdminClient("pending"));

    const mod = await import("./route");
    const response = await mod.POST(
      new Request("http://localhost/api/meetings/meeting-1/retry", {
        method: "POST",
      }) as NextRequest,
      { params: { id: "meeting-1" } }
    );

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({
      error: "Somente reuniões com falha podem ser reprocessadas manualmente.",
    });
    expect(inngestSend).not.toHaveBeenCalled();
  });

  it("re-enqueues a failed meeting", async () => {
    const adminClient = createRetryAdminClient("failed");
    createServiceRoleClient.mockReturnValue(adminClient);

    const mod = await import("./route");
    const response = await mod.POST(
      new Request("http://localhost/api/meetings/meeting-1/retry", {
        method: "POST",
      }) as NextRequest,
      { params: { id: "meeting-1" } }
    );

    expect(response.status).toBe(200);
    expect(inngestSend).toHaveBeenCalledWith({
      name: "meeting/process",
      data: {
        meetingId: "meeting-1",
        r2Key: "meetings/user-1/audio.mp3",
        whatsappNumber: "5511999999999",
        userId: "user-1",
      },
    });
    expect(adminClient.update).toHaveBeenCalledWith({
      status: "pending",
      error_message: null,
    });
  });
});
