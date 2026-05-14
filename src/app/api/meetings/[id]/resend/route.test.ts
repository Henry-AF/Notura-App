import type { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const createServerSupabase = vi.fn();
const createServiceRoleClient = vi.fn();
const getWhatsAppSummaryAccess = vi.fn();
const sendMeetingSummaryTemplate = vi.fn();

const paidPlanMessage =
  "Envio do resumo pelo WhatsApp está disponível apenas para assinantes dos planos Pro e Platinum.";

vi.mock("@/lib/supabase/server", () => ({
  createServerSupabase,
  createServiceRoleClient,
}));

vi.mock("@/lib/billing/whatsapp-summary-access", () => ({
  WHATSAPP_SUMMARY_PAID_PLAN_REQUIRED_MESSAGE: paidPlanMessage,
  getWhatsAppSummaryAccess,
}));

vi.mock("@/lib/whatsapp", () => ({
  sendMeetingSummaryTemplate,
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

function createResendAdminClient() {
  const ownershipMaybeSingle = vi.fn().mockResolvedValue({
    data: { id: "meeting-1", user_id: "user-1" },
    error: null,
  });
  const meetingSingle = vi.fn().mockResolvedValue({
    data: {
      id: "meeting-1",
      user_id: "user-1",
      title: "Reuniao",
      summary_whatsapp: "Resumo pronto",
      whatsapp_number: "5511999999999",
      whatsapp_status: "failed",
      summary_json: { metadata: true },
    },
    error: null,
  });
  const updateEq = vi.fn().mockResolvedValue({ error: null });
  const update = vi.fn().mockReturnValue({ eq: updateEq });
  const select = vi.fn((fields: string) => ({
    eq: vi.fn().mockReturnValue(
      fields === "id, user_id"
        ? { maybeSingle: ownershipMaybeSingle }
        : { single: meetingSingle }
    ),
  }));
  const from = vi.fn().mockReturnValue({ select, update });

  return {
    from,
    update,
  };
}

describe("POST /api/meetings/[id]/resend", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();

    createServerSupabase.mockReturnValue(createServerClient({ id: "user-1" }));
    getWhatsAppSummaryAccess.mockResolvedValue({ canSend: true, plan: "pro" });
    sendMeetingSummaryTemplate.mockResolvedValue({ success: true });
  });

  it("blocks manual WhatsApp resends for users without a paid plan", async () => {
    const adminClient = createResendAdminClient();
    createServiceRoleClient.mockReturnValue(adminClient);
    getWhatsAppSummaryAccess.mockResolvedValue({ canSend: false, plan: "free" });

    const mod = await import("./route");
    const response = await mod.POST(
      new Request("http://localhost/api/meetings/meeting-1/resend", {
        method: "POST",
      }) as NextRequest,
      { params: { id: "meeting-1" } }
    );

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: paidPlanMessage });
    expect(getWhatsAppSummaryAccess).toHaveBeenCalledWith(
      "user-1",
      expect.any(Object)
    );
    expect(sendMeetingSummaryTemplate).not.toHaveBeenCalled();
    expect(adminClient.update).not.toHaveBeenCalled();
  });
});
