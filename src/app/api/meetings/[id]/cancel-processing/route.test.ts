import type { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const createServerSupabase = vi.fn();
const createServiceRoleClient = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createServerSupabase,
  createServiceRoleClient,
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

function createCancelAdminClient(meetingStatus: string) {
  const ownershipMaybeSingle = vi.fn().mockResolvedValue({
    data: { id: "meeting-1", user_id: "user-1" },
    error: null,
  });
  const meetingSingle = vi.fn().mockResolvedValue({
    data: {
      id: "meeting-1",
      status: meetingStatus,
      audio_r2_key: "meetings/user-1/audio.mp3",
    },
    error: null,
  });

  const selectEq = vi.fn(() => ({
    maybeSingle: ownershipMaybeSingle,
    single: meetingSingle,
  }));
  const select = vi.fn(() => ({ eq: selectEq }));

  const meetingsUpdateEq = vi.fn().mockResolvedValue({ error: null });
  const jobsUpdateIn = vi.fn().mockResolvedValue({ error: null });
  const jobsUpdateEq = vi.fn(() => ({ in: jobsUpdateIn }));
  const meetingsUpdate = vi.fn((payload: unknown) => ({
    eq: meetingsUpdateEq,
    payload,
  }));
  const jobsUpdate = vi.fn((payload: unknown) => ({
    eq: jobsUpdateEq,
    payload,
  }));

  const from = vi.fn((table: string) => ({
    select,
    update: table === "jobs" ? jobsUpdate : meetingsUpdate,
  }));

  return {
    from,
    meetingsUpdate,
    meetingsUpdateEq,
    jobsUpdate,
    jobsUpdateEq,
    jobsUpdateIn,
  };
}

describe("POST /api/meetings/[id]/cancel-processing", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();

    createServerSupabase.mockReturnValue(createServerClient({ id: "user-1" }));
  });

  it("marks a processing meeting as failed without deleting the audio reference", async () => {
    const adminClient = createCancelAdminClient("processing");
    createServiceRoleClient.mockReturnValue(adminClient);

    const mod = await import("./route");
    const response = await mod.POST(
      new Request("http://localhost/api/meetings/meeting-1/cancel-processing", {
        method: "POST",
      }) as NextRequest,
      { params: { id: "meeting-1" } }
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      success: true,
      meetingId: "meeting-1",
      status: "failed",
    });
    expect(adminClient.meetingsUpdate).toHaveBeenCalledWith({
      status: "failed",
      error_message: "Processamento cancelado pelo usuário.",
    });
    expect(adminClient.meetingsUpdate.mock.calls[0]?.[0]).not.toHaveProperty(
      "audio_r2_key"
    );
    expect(adminClient.jobsUpdate).toHaveBeenCalledWith({
      status: "failed",
      error_message: "Processamento cancelado pelo usuário.",
      completed_at: expect.any(String),
    });
    expect(adminClient.jobsUpdateEq).toHaveBeenCalledWith("meeting_id", "meeting-1");
    expect(adminClient.jobsUpdateIn).toHaveBeenCalledWith("status", [
      "queued",
      "processing",
    ]);
  });

  it("rejects completed meetings because there is no active processing to cancel", async () => {
    const adminClient = createCancelAdminClient("completed");
    createServiceRoleClient.mockReturnValue(adminClient);

    const mod = await import("./route");
    const response = await mod.POST(
      new Request("http://localhost/api/meetings/meeting-1/cancel-processing", {
        method: "POST",
      }) as NextRequest,
      { params: { id: "meeting-1" } }
    );

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({
      error: "Somente reuniões em processamento podem ser canceladas.",
    });
    expect(adminClient.meetingsUpdate).not.toHaveBeenCalled();
    expect(adminClient.jobsUpdate).not.toHaveBeenCalled();
  });
});
