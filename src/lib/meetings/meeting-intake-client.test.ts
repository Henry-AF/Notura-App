import { beforeEach, describe, expect, it, vi } from "vitest";

function createJsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status });
}

function mockGroupsResponse() {
  return createJsonResponse({
    groups: [
      {
        id: "group-1",
        name: "Acme",
        created_at: "2026-04-16T12:00:00Z",
        updated_at: "2026-04-16T12:00:00Z",
        meetings_count: 0,
      },
    ],
    meetings: [],
  });
}

function mockUserResponse(user: Record<string, unknown>) {
  return createJsonResponse({ user });
}

function mockDefaultsFetch(user: Record<string, unknown>) {
  return vi.spyOn(globalThis, "fetch").mockImplementation((input) => {
    if (input === "/api/meeting-groups") {
      return Promise.resolve(mockGroupsResponse());
    }

    return Promise.resolve(mockUserResponse(user));
  });
}

describe("meeting intake defaults", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("fetches the current user's whatsapp defaults through /api/user/me", async () => {
    const fetchMock = mockDefaultsFetch({
      whatsappNumber: "+55 (11) 99999-9999",
      canSendWhatsAppSummary: true,
      canProcessMeetings: true,
      meetingQuotaBlockCode: null,
      meetingQuotaLimit: 30,
    });

    const mod = await import("./meeting-intake-client");
    const result = await mod.fetchMeetingIntakeDefaults();

    expect(fetchMock).toHaveBeenCalledWith("/api/user/me", { method: "GET" });
    expect(result).toEqual({
      accountWhatsappNumber: "5511999999999",
      canSendWhatsAppSummary: true,
      canProcessMeetings: true,
      meetingQuotaMessage: "",
      meetingGroups: [{ id: "group-1", name: "Acme" }],
    });
  });

  it("keeps WhatsApp summary disabled for non-paying users", async () => {
    mockDefaultsFetch({
      whatsappNumber: "+55 (11) 99999-9999",
      canSendWhatsAppSummary: false,
      canProcessMeetings: true,
      meetingQuotaBlockCode: null,
      meetingQuotaLimit: 3,
    });

    const mod = await import("./meeting-intake-client");
    const result = await mod.fetchMeetingIntakeDefaults();

    expect(result).toEqual({
      accountWhatsappNumber: "5511999999999",
      canSendWhatsAppSummary: false,
      canProcessMeetings: true,
      meetingQuotaMessage: "",
      meetingGroups: [{ id: "group-1", name: "Acme" }],
    });
  });
});

describe("meeting quota gate", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("maps exhausted quota to a safe recording gate message", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation((input) => {
      if (input === "/api/meeting-groups") {
        return Promise.resolve(createJsonResponse({ groups: [], meetings: [] }));
      }

      return Promise.resolve(
        mockUserResponse({
          whatsappNumber: "+55 (11) 99999-9999",
          canSendWhatsAppSummary: false,
          canProcessMeetings: false,
          meetingQuotaBlockCode: "period_quota_exceeded",
          meetingQuotaLimit: 30,
        })
      );
    });

    const mod = await import("./meeting-intake-client");
    const result = await mod.fetchMeetingIntakeDefaults();

    expect(result).toEqual({
      accountWhatsappNumber: "5511999999999",
      canSendWhatsAppSummary: false,
      canProcessMeetings: false,
      meetingQuotaMessage:
        "Você atingiu o limite de reuniões do período atual do seu plano. Faça upgrade ou aguarde a renovação para processar novas reuniões.",
      meetingGroups: [],
    });
  });

  it("fetches only the current quota gate for start-time revalidation", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      mockUserResponse({
        canProcessMeetings: false,
        meetingQuotaBlockCode: "subscription_expired",
        meetingQuotaLimit: 30,
      })
    );

    const mod = await import("./meeting-intake-client");
    const result = await mod.fetchMeetingQuotaGate();

    expect(fetchMock).toHaveBeenCalledWith("/api/user/me", { method: "GET" });
    expect(result).toEqual({
      canProcessMeetings: false,
      meetingQuotaMessage:
        "Sua assinatura expirou. Renove seu plano para processar novas reuniões.",
    });
  });
});

describe("meeting upload intake", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("initializes direct upload through /api/meetings/upload", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      createJsonResponse({
        r2Key: "meetings/user-1/123/audio.mp3",
        uploadUrl: "https://r2.example/upload",
        uploadToken: "signed-upload-token",
      })
    );

    const mod = await import("./meeting-intake-client");
    const result = await mod.initMeetingUpload({
      fileName: "audio.mp3",
      contentType: "audio/mpeg",
      fileSize: 1024,
    });

    expect(fetchMock).toHaveBeenCalledWith("/api/meetings/upload", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        fileName: "audio.mp3",
        contentType: "audio/mpeg",
        fileSize: 1024,
      }),
    });
    expect(result).toEqual({
      r2Key: "meetings/user-1/123/audio.mp3",
      uploadUrl: "https://r2.example/upload",
      uploadToken: "signed-upload-token",
    });
  });

  it("creates the meeting through /api/meetings/process", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      createJsonResponse({ meetingId: "meeting-1" }, 201)
    );

    const mod = await import("./meeting-intake-client");
    const meetingId = await mod.processUploadedMeeting({
      meetingDate: "2026-04-16",
      whatsappNumber: "5511999999999",
      r2Key: "meetings/user-1/123/audio.mp3",
      uploadToken: "signed-upload-token",
      groupId: "group-1",
    });

    expect(fetchMock).toHaveBeenCalledWith("/api/meetings/process", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        meetingDate: "2026-04-16",
        whatsappNumber: "5511999999999",
        r2Key: "meetings/user-1/123/audio.mp3",
        uploadToken: "signed-upload-token",
        groupId: "group-1",
      }),
    });
    expect(meetingId).toBe("meeting-1");
  });
});
