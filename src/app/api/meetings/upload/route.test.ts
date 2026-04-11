import type { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const createServerSupabase = vi.fn();
const createServiceRoleClient = vi.fn();
const buildR2Key = vi.fn();
const uploadAudio = vi.fn();
const inngestSend = vi.fn();
const getBillingStatus = vi.fn();
const syncMeetingsThisMonth = vi.fn();
const meetingsInsert = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createServerSupabase,
  createServiceRoleClient,
}));

vi.mock("@/lib/r2", () => ({
  buildR2Key,
  uploadAudio,
}));

vi.mock("@/lib/inngest", () => ({
  inngest: {
    send: inngestSend,
  },
}));

vi.mock("@/lib/billing", () => ({
  getBillingStatus,
  syncMeetingsThisMonth,
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

function createMeetingInsertClient() {
  const single = vi.fn().mockResolvedValue({
    data: { id: "meeting-1" },
    error: null,
  });
  const select = vi.fn().mockReturnValue({ single });
  meetingsInsert.mockImplementation(() => ({ select }));
  const from = vi.fn().mockReturnValue({ insert: meetingsInsert });

  return { from };
}

describe("POST /api/meetings/upload", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    meetingsInsert.mockClear();

    createServerSupabase.mockReturnValue(createServerClient({ id: "user-1" }));
    createServiceRoleClient.mockReturnValue(createMeetingInsertClient());
    buildR2Key.mockReturnValue("user-1/audio.mp3");
    uploadAudio.mockResolvedValue(undefined);
    inngestSend.mockResolvedValue(undefined);
    getBillingStatus.mockResolvedValue({
      billingAccount: { plan: "pro" },
      meetingsThisMonth: 0,
      monthlyLimit: 30,
    });
    syncMeetingsThisMonth.mockResolvedValue(undefined);
  });

  it("rejects meeting_date when it is after today", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-10T09:00:00.000Z"));

    const formData = new FormData();
    formData.append(
      "audio",
      new File([new Uint8Array([1, 2, 3])], "audio.mp3", { type: "audio/mpeg" })
    );
    formData.append("client_name", "Acme");
    formData.append("meeting_date", "2026-04-11");
    formData.append("whatsapp_number", "+5511999999999");

    const mod = await import("./route");
    const response = await mod.POST(
      new Request("http://localhost/api/meetings/upload", {
        method: "POST",
        body: formData,
      }) as NextRequest,
      { params: {} } as never
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: "A data da reunião não pode ser maior que hoje.",
    });
    expect(uploadAudio).not.toHaveBeenCalled();
    expect(inngestSend).not.toHaveBeenCalled();

    vi.useRealTimers();
  });

  it("normalizes whatsapp_number before saving and enqueueing", async () => {
    const formData = new FormData();
    formData.append(
      "audio",
      new File([new Uint8Array([1, 2, 3])], "audio.mp3", { type: "audio/mpeg" })
    );
    formData.append("client_name", "Acme");
    formData.append("meeting_date", "2026-04-10");
    formData.append("whatsapp_number", "(11) 98888-7777");

    const mod = await import("./route");
    const response = await mod.POST(
      new Request("http://localhost/api/meetings/upload", {
        method: "POST",
        body: formData,
      }) as NextRequest,
      { params: {} } as never
    );

    expect(response.status).toBe(201);
    expect(meetingsInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        whatsapp_number: "5511988887777",
      })
    );
    expect(inngestSend).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          whatsappNumber: "5511988887777",
        }),
      })
    );
  });
});
