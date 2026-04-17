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

type RetryMeetingStatus = "pending" | "processing" | "failed" | "completed";
type RetryClaimResult = "claimed" | "already_claimed";

interface RetryAdminClientOptions {
  meetingStatus: RetryMeetingStatus;
  claimResult?: RetryClaimResult;
  audioR2Key?: string | null;
}

function createRetryAdminClient({
  meetingStatus,
  claimResult = "claimed",
  audioR2Key = "meetings/user-1/audio.mp3",
}: RetryAdminClientOptions) {
  const ownershipMaybeSingle = vi.fn().mockResolvedValue({
    data: { id: "meeting-1", user_id: "user-1" },
    error: null,
  });

  const meetingSingle = vi.fn().mockResolvedValue({
    data: {
      id: "meeting-1",
      audio_r2_key: audioR2Key,
      whatsapp_number: "5511999999999",
      status: meetingStatus,
    },
    error: null,
  });

  const select = vi.fn();
  select.mockReturnValueOnce({
    eq: vi.fn().mockReturnValue({
      maybeSingle: ownershipMaybeSingle,
    }),
  });
  select.mockReturnValueOnce({
    eq: vi.fn().mockReturnValue({
      single: meetingSingle,
    }),
  });

  const claimMaybeSingle = vi.fn().mockResolvedValue({
    data: claimResult === "claimed" ? { id: "meeting-1" } : null,
    error: null,
  });
  const claimSelect = vi.fn().mockReturnValue({ maybeSingle: claimMaybeSingle });
  const claimStatusEq = vi.fn().mockReturnValue({ select: claimSelect });
  const claimIdEq = vi.fn().mockReturnValue({ eq: claimStatusEq });

  const rollbackStatusEq = vi.fn().mockResolvedValue({ error: null });
  const rollbackIdEq = vi.fn().mockReturnValue({ eq: rollbackStatusEq });

  const update = vi.fn();
  update.mockReturnValueOnce({ eq: claimIdEq });
  update.mockReturnValue({ eq: rollbackIdEq });

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

  it("returns idempotent success when meeting is already pending", async () => {
    createServiceRoleClient.mockReturnValue(
      createRetryAdminClient({ meetingStatus: "pending" })
    );

    const mod = await import("./route");
    const response = await mod.POST(
      new Request("http://localhost/api/meetings/meeting-1/retry", {
        method: "POST",
      }) as NextRequest,
      { params: { id: "meeting-1" } }
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      success: true,
      meetingId: "meeting-1",
      idempotent: true,
      alreadyQueued: true,
    });
    expect(inngestSend).not.toHaveBeenCalled();
  });

  it("re-enqueues a failed meeting exactly once", async () => {
    const adminClient = createRetryAdminClient({
      meetingStatus: "failed",
      claimResult: "claimed",
    });
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

  it("returns idempotent success when another request already claimed the retry", async () => {
    createServiceRoleClient.mockReturnValue(
      createRetryAdminClient({
        meetingStatus: "failed",
        claimResult: "already_claimed",
      })
    );

    const mod = await import("./route");
    const response = await mod.POST(
      new Request("http://localhost/api/meetings/meeting-1/retry", {
        method: "POST",
      }) as NextRequest,
      { params: { id: "meeting-1" } }
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      success: true,
      meetingId: "meeting-1",
      idempotent: true,
      alreadyQueued: true,
    });
    expect(inngestSend).not.toHaveBeenCalled();
  });
});
