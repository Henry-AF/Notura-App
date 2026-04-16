import { beforeEach, describe, expect, it, vi } from "vitest";

describe("meeting intake client", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("fetches the current user's whatsapp defaults through /api/user/me", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          user: {
            whatsappNumber: "+55 (11) 99999-9999",
          },
        }),
        { status: 200 }
      )
    );

    const mod = await import("./meeting-intake-client");
    const result = await mod.fetchMeetingIntakeDefaults();

    expect(fetchMock).toHaveBeenCalledWith("/api/user/me", { method: "GET" });
    expect(result).toEqual({
      accountWhatsappNumber: "5511999999999",
    });
  });

  it("initializes direct upload through /api/meetings/upload", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          r2Key: "meetings/user-1/123/audio.mp3",
          uploadUrl: "https://r2.example/upload",
          uploadToken: "signed-upload-token",
        }),
        { status: 200 }
      )
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
      new Response(
        JSON.stringify({
          meetingId: "meeting-1",
        }),
        { status: 201 }
      )
    );

    const mod = await import("./meeting-intake-client");
    const meetingId = await mod.processUploadedMeeting({
      clientName: "Acme",
      meetingDate: "2026-04-16",
      whatsappNumber: "5511999999999",
      r2Key: "meetings/user-1/123/audio.mp3",
      uploadToken: "signed-upload-token",
    });

    expect(fetchMock).toHaveBeenCalledWith("/api/meetings/process", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        clientName: "Acme",
        meetingDate: "2026-04-16",
        whatsappNumber: "5511999999999",
        r2Key: "meetings/user-1/123/audio.mp3",
        uploadToken: "signed-upload-token",
      }),
    });
    expect(meetingId).toBe("meeting-1");
  });
});
