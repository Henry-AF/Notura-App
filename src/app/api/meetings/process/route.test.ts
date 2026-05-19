import type { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const createServerSupabase = vi.fn();
const createServiceRoleClient = vi.fn();
const inngestSend = vi.fn();
const getBillingStatus = vi.fn();
const consumeMeetingQuota = vi.fn();
const refundMeetingQuota = vi.fn();
const incrementMeetingsThisMonth = vi.fn();
const getWhatsAppSummaryAccess = vi.fn();
const meetingsInsert = vi.fn();
const meetingsSelect = vi.fn();
const meetingsSelectEq = vi.fn();
const meetingsSelectIn = vi.fn();
const meetingsSelectOrder = vi.fn();
const meetingsSelectMaybeSingle = vi.fn();
const meetingsUpdate = vi.fn();
const meetingsUpdateEq = vi.fn();
const verifyUploadToken = vi.fn();
const doesObjectExist = vi.fn();
const getObjectMetadata = vi.fn();

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
  consumeMeetingQuota,
  refundMeetingQuota,
  incrementMeetingsThisMonth,
}));

vi.mock("@/lib/billing/whatsapp-summary-access", () => ({
  getWhatsAppSummaryAccess,
}));

vi.mock("@/lib/meetings/upload-token", () => ({
  verifyUploadToken,
}));

vi.mock("@/lib/r2", () => ({
  doesObjectExist,
  getObjectMetadata,
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
  const insertSelect = vi.fn().mockReturnValue({ single });
  meetingsInsert.mockImplementation(() => ({ select: insertSelect }));
  meetingsSelectMaybeSingle.mockResolvedValue({ data: null, error: null });
  meetingsSelectOrder.mockReturnValue({ maybeSingle: meetingsSelectMaybeSingle });
  meetingsSelectIn.mockReturnValue({ order: meetingsSelectOrder });
  meetingsSelectEq.mockReturnValue({
    eq: meetingsSelectEq,
    in: meetingsSelectIn,
    order: meetingsSelectOrder,
    maybeSingle: meetingsSelectMaybeSingle,
  });
  meetingsSelect.mockReturnValue({
    eq: meetingsSelectEq,
    in: meetingsSelectIn,
    order: meetingsSelectOrder,
    maybeSingle: meetingsSelectMaybeSingle,
  });
  meetingsUpdateEq.mockResolvedValue({ error: null });
  meetingsUpdate.mockReturnValue({ eq: meetingsUpdateEq });

  return {
    from: vi.fn().mockReturnValue({
      select: meetingsSelect,
      insert: meetingsInsert,
      update: meetingsUpdate,
    }),
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
      billingAccount: {
        plan: "pro",
        meetings_used: 3,
        current_period_end: "2026-05-27T12:00:00.000Z",
      },
      meetingsThisMonth: 3,
      meetingsUsed: 3,
      monthlyLimit: 30,
      quotaStatus: {
        allowed: true,
        code: null,
        meetingsUsed: 3,
        quotaLimit: 30,
      },
    });
    getWhatsAppSummaryAccess.mockResolvedValue({ canSend: true, plan: "pro" });
    consumeMeetingQuota.mockResolvedValue({ meetingsUsed: 4, plan: "pro" });
    refundMeetingQuota.mockResolvedValue(undefined);
    incrementMeetingsThisMonth.mockResolvedValue(4);
    verifyUploadToken.mockReturnValue({
      userId: "user-1",
      r2Key: "meetings/user-1/audio.mp3",
      contentType: "audio/mpeg",
      fileSize: 123,
      expiresAt: Date.now() + 60_000,
    });
    doesObjectExist.mockResolvedValue(true);
    getObjectMetadata.mockResolvedValue({
      contentLength: 123,
      contentType: "audio/mpeg",
    });
  });

  it("logs queue diagnostics before sending the Inngest event", async () => {
    const consoleInfo = vi.spyOn(console, "info").mockImplementation(() => {});

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
    expect(consoleInfo).toHaveBeenCalledWith(
      "[meetings/process] queue send diagnostics:",
      expect.objectContaining({
        meetingId: "meeting-1",
        userId: "user-1",
        nowEpochMs: expect.any(Number),
        nowIso: expect.any(String),
      })
    );
  });

  it("returns the existing meeting and skips queue when the upload was already registered", async () => {
    meetingsSelectMaybeSingle.mockResolvedValue({
      data: { id: "meeting-existing", status: "pending" },
      error: null,
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

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      meetingId: "meeting-existing",
      status: "pending",
    });
    expect(meetingsInsert).not.toHaveBeenCalled();
    expect(inngestSend).not.toHaveBeenCalled();
    expect(consumeMeetingQuota).not.toHaveBeenCalled();
  });

  it("blocks free meeting creation when the lifetime limit is reached", async () => {
    getBillingStatus.mockResolvedValue({
      billingAccount: { plan: "free", meetings_used: 3 },
      meetingsThisMonth: 3,
      meetingsUsed: 3,
      monthlyLimit: 3,
      quotaStatus: {
        allowed: false,
        code: "lifetime_quota_exceeded",
        message:
          "Você atingiu o limite lifetime do plano Free. Faça upgrade para processar mais reuniões.",
        meetingsUsed: 3,
        quotaLimit: 3,
      },
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
        "Você atingiu o limite lifetime do plano Free. Faça upgrade para processar mais reuniões.",
    });
    expect(meetingsInsert).not.toHaveBeenCalled();
    expect(inngestSend).not.toHaveBeenCalled();
  });

  it("blocks paid meeting creation when the subscription period expired", async () => {
    getBillingStatus.mockResolvedValue({
      billingAccount: {
        plan: "pro",
        meetings_used: 12,
        current_period_end: "2026-04-01T00:00:00.000Z",
      },
      meetingsThisMonth: 12,
      meetingsUsed: 12,
      monthlyLimit: 30,
      quotaStatus: {
        allowed: false,
        code: "subscription_expired",
        message:
          "Sua assinatura expirou. Renove o plano para processar novas reuniões.",
        meetingsUsed: 12,
        quotaLimit: 30,
      },
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
      error: "Sua assinatura expirou. Renove o plano para processar novas reuniões.",
    });
    expect(meetingsInsert).not.toHaveBeenCalled();
    expect(inngestSend).not.toHaveBeenCalled();
    expect(consumeMeetingQuota).not.toHaveBeenCalled();
  });

  it("normalizes whatsapp and consumes billing quota after successful creation", async () => {
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
    expect(consumeMeetingQuota).toHaveBeenCalledWith("user-1");
    expect(refundMeetingQuota).not.toHaveBeenCalled();
    expect(incrementMeetingsThisMonth).not.toHaveBeenCalled();
  });

  it("creates a free meeting with a selected group without a WhatsApp recipient", async () => {
    getBillingStatus.mockResolvedValue({
      billingAccount: { plan: "free", meetings_used: 1 },
      meetingsThisMonth: 1,
      meetingsUsed: 1,
      monthlyLimit: 3,
      quotaStatus: {
        allowed: true,
        code: null,
        meetingsUsed: 1,
        quotaLimit: 3,
      },
    });
    getWhatsAppSummaryAccess.mockResolvedValue({ canSend: false, plan: "free" });

    meetingsSelectMaybeSingle
      .mockResolvedValueOnce({
        data: { id: "group-1", user_id: "user-1" },
        error: null,
      })
      .mockResolvedValueOnce({ data: null, error: null });

    const mod = await import("./route");
    const response = await mod.POST(
      new Request("http://localhost/api/meetings/process", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          clientName: "Acme",
          meetingDate: "2026-04-10",
          r2Key: "meetings/user-1/audio.mp3",
          uploadToken: "valid-token",
          groupId: "group-1",
          plan: "team",
        }),
      }) as NextRequest,
      { params: {} } as never
    );

    expect(response.status).toBe(201);
    expect(getWhatsAppSummaryAccess).toHaveBeenCalledWith(
      "user-1",
      expect.any(Object)
    );
    expect(meetingsInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        group_id: "group-1",
        whatsapp_number: "",
      })
    );
    expect(inngestSend).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          whatsappNumber: "",
          userId: "user-1",
        }),
      })
    );
  });

  it("stores the selected meeting group when it belongs to the user", async () => {
    meetingsSelectMaybeSingle
      .mockResolvedValueOnce({
        data: { id: "group-1", user_id: "user-1" },
        error: null,
      })
      .mockResolvedValueOnce({ data: null, error: null });

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
          groupId: "group-1",
        }),
      }) as NextRequest,
      { params: {} } as never
    );

    expect(response.status).toBe(201);
    expect(meetingsInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        group_id: "group-1",
      })
    );
  });

  it("still requires a WhatsApp recipient for paid users", async () => {
    getWhatsAppSummaryAccess.mockResolvedValue({ canSend: true, plan: "pro" });

    const mod = await import("./route");
    const response = await mod.POST(
      new Request("http://localhost/api/meetings/process", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          clientName: "Acme",
          meetingDate: "2026-04-10",
          r2Key: "meetings/user-1/audio.mp3",
          uploadToken: "valid-token",
        }),
      }) as NextRequest,
      { params: {} } as never
    );

    expect(response.status).toBe(422);
    expect(await response.json()).toEqual({
      error: "Número de WhatsApp é obrigatório.",
    });
    expect(meetingsInsert).not.toHaveBeenCalled();
    expect(inngestSend).not.toHaveBeenCalled();
  });

  it("returns queue error and marks meeting as failed when enqueueing fails", async () => {
    inngestSend.mockRejectedValue(new Error("queue unavailable"));

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

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({
      error:
        "Houve um erro ao iniciar o processamento desta reunião. Tente processar novamente.",
    });
    expect(consumeMeetingQuota).toHaveBeenCalledWith("user-1");
    expect(refundMeetingQuota).toHaveBeenCalledWith("user-1");
    expect(incrementMeetingsThisMonth).not.toHaveBeenCalled();
    expect(meetingsUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "failed",
        error_message: "Falha ao enfileirar processamento da reunião.",
      })
    );
    expect(meetingsUpdateEq).toHaveBeenCalledWith("id", "meeting-1");
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
    getObjectMetadata.mockResolvedValue(null);

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

  it("rejects processing when the uploaded object exceeds 500MB", async () => {
    getObjectMetadata.mockResolvedValue({
      contentLength: 501 * 1024 * 1024,
      contentType: "audio/mpeg",
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

    expect(response.status).toBe(413);
    expect(await response.json()).toEqual({
      error: "Arquivo muito grande (501MB). O limite é 500MB.",
    });
    expect(meetingsInsert).not.toHaveBeenCalled();
    expect(inngestSend).not.toHaveBeenCalled();
  });

  it("rejects processing when the uploaded object size differs from the authorized upload", async () => {
    getObjectMetadata.mockResolvedValue({
      contentLength: 456,
      contentType: "audio/mpeg",
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

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({
      error: "Tamanho do upload não confere com o arquivo autorizado. Reenvie o arquivo e tente novamente.",
    });
    expect(meetingsInsert).not.toHaveBeenCalled();
    expect(inngestSend).not.toHaveBeenCalled();
  });
});
