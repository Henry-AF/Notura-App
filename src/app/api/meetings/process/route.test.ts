import type { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const createServerSupabase = vi.fn();
const createServiceRoleClient = vi.fn();
const inngestSend = vi.fn();
const getBillingStatus = vi.fn();
const syncMeetingsThisMonth = vi.fn();
const meetingsInsert = vi.fn();
const verifyUploadToken = vi.fn();
const doesObjectExist = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createServerSupabase,
  createServiceRoleClient,
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

vi.mock("@/lib/meetings/upload-token", () => ({
  verifyUploadToken,
}));

vi.mock("@/lib/r2", () => ({
  doesObjectExist,
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

  return {
    from: vi.fn().mockReturnValue({ insert: meetingsInsert }),
  };
}

describe("POST /api/meetings/process", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();

    createServerSupabase.mockReturnValue(createServerClient({ id: "user-1" }));
    createServiceRoleClient.mockReturnValue(createMeetingInsertClient());
    inngestSend.mockResolvedValue(undefined);
    getBillingStatus.mockResolvedValue({
      billingAccount: { plan: "pro" },
      meetingsThisMonth: 3,
      monthlyLimit: 30,
    });
    syncMeetingsThisMonth.mockResolvedValue(undefined);
    verifyUploadToken.mockReturnValue({
      userId: "user-1",
      r2Key: "meetings/user-1/audio.mp3",
      contentType: "audio/mpeg",
      fileSize: 123,
      expiresAt: Date.now() + 60_000,
    });
    doesObjectExist.mockResolvedValue(true);
  });

  it("blocks meeting creation when the monthly limit is reached", async () => {
    getBillingStatus.mockResolvedValue({
      billingAccount: { plan: "free" },
      meetingsThisMonth: 3,
      monthlyLimit: 3,
    });

    const mod = await import("./route");
    const response = await mod.POST(
      new Request("http://localhost/api/meetings/process", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          clientName: "Acme",
          meetingDate: "2026-04-10",
          r2Key: "meetings/user-1/audio.mp3",
          whatsappNumber: "(11) 98888-7777",
          uploadToken: "valid-token",
        }),
      }) as NextRequest,
      { params: {} } as never
    );

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({
      error:
        "Você atingiu o limite do plano Free. Faça upgrade para processar mais reuniões.",
    });
    expect(meetingsInsert).not.toHaveBeenCalled();
    expect(inngestSend).not.toHaveBeenCalled();
  });

  it("normalizes whatsapp and syncs billing usage after successful creation", async () => {
    const mod = await import("./route");
    const response = await mod.POST(
      new Request("http://localhost/api/meetings/process", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          clientName: "Acme",
          meetingDate: "2026-04-10",
          r2Key: "meetings/user-1/audio.mp3",
          whatsappNumber: "(11) 98888-7777",
          uploadToken: "valid-token",
        }),
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
          meetingId: "meeting-1",
          whatsappNumber: "5511988887777",
          userId: "user-1",
        }),
      })
    );
    expect(syncMeetingsThisMonth).toHaveBeenCalledWith("user-1", 4);
  });

  it("rejects invalid upload tokens", async () => {
    verifyUploadToken.mockImplementation(() => {
      throw new Error("Token de upload inválido.");
    });

    const mod = await import("./route");
    const response = await mod.POST(
      new Request("http://localhost/api/meetings/process", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          clientName: "Acme",
          meetingDate: "2026-04-10",
          r2Key: "meetings/user-1/audio.mp3",
          whatsappNumber: "(11) 98888-7777",
          uploadToken: "tampered-token",
        }),
      }) as NextRequest,
      { params: {} } as never
    );

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({
      error: "Token de upload inválido.",
    });
    expect(meetingsInsert).not.toHaveBeenCalled();
    expect(inngestSend).not.toHaveBeenCalled();
  });

  it("rejects tampered r2 keys even with a valid token", async () => {
    verifyUploadToken.mockReturnValue({
      userId: "user-1",
      r2Key: "meetings/user-1/original.mp3",
      contentType: "audio/mpeg",
      fileSize: 123,
      expiresAt: Date.now() + 60_000,
    });

    const mod = await import("./route");
    const response = await mod.POST(
      new Request("http://localhost/api/meetings/process", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          clientName: "Acme",
          meetingDate: "2026-04-10",
          r2Key: "meetings/user-1/tampered.mp3",
          whatsappNumber: "(11) 98888-7777",
          uploadToken: "valid-token",
        }),
      }) as NextRequest,
      { params: {} } as never
    );

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({
      error: "Upload não autorizado para este arquivo.",
    });
    expect(meetingsInsert).not.toHaveBeenCalled();
    expect(inngestSend).not.toHaveBeenCalled();
  });

  it("rejects processing when the uploaded object is missing in R2", async () => {
    doesObjectExist.mockResolvedValue(false);

    const mod = await import("./route");
    const response = await mod.POST(
      new Request("http://localhost/api/meetings/process", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          clientName: "Acme",
          meetingDate: "2026-04-10",
          r2Key: "meetings/user-1/audio.mp3",
          whatsappNumber: "(11) 98888-7777",
          uploadToken: "valid-token",
        }),
      }) as NextRequest,
      { params: {} } as never
    );

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({
      error: "Upload não encontrado no storage. Reenvie o arquivo e tente novamente.",
    });
    expect(meetingsInsert).not.toHaveBeenCalled();
    expect(inngestSend).not.toHaveBeenCalled();
  });
});
