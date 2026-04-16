import { beforeEach, describe, expect, it, vi } from "vitest";

const fetchMeetingIntakeDefaults = vi.fn();
const initMeetingUpload = vi.fn();
const processUploadedMeeting = vi.fn();
const uploadFileToSignedUrl = vi.fn();

vi.mock("@/lib/meetings/meeting-intake-client", () => ({
  fetchMeetingIntakeDefaults,
  initMeetingUpload,
  processUploadedMeeting,
}));

vi.mock("@/lib/meetings/upload-client", () => ({
  uploadFileToSignedUrl,
}));

describe("recording page api client", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("loads recording defaults from the shared meeting intake client", async () => {
    fetchMeetingIntakeDefaults.mockResolvedValue({
      accountWhatsappNumber: "5511999999999",
    });

    const mod = await import("./recording-api");
    const result = await mod.fetchRecordingDefaults();

    expect(result).toEqual({
      accountWhatsappNumber: "5511999999999",
    });
    expect(fetchMeetingIntakeDefaults).toHaveBeenCalledTimes(1);
  });

  it("uploads the recorded file and queues processing with today's meeting date", async () => {
    initMeetingUpload.mockResolvedValue({
      r2Key: "meetings/user-1/123/recording.mp4",
      uploadUrl: "https://r2.example/upload",
      uploadToken: "signed-upload-token",
    });
    uploadFileToSignedUrl.mockResolvedValue(undefined);
    processUploadedMeeting.mockResolvedValue("meeting-1");

    const mod = await import("./recording-api");
    const progressSpy = vi.fn();
    const meetingId = await mod.submitRecordedMeeting({
      clientName: "Acme",
      whatsappNumber: "5511999999999",
      recording: new Blob(["recording"], { type: "video/mp4" }),
      recordedAt: new Date(2026, 3, 16, 14, 30, 0),
      onUploadProgress: progressSpy,
    });

    expect(initMeetingUpload).toHaveBeenCalledWith({
      fileName: "recording-2026-04-16-14-30-00.mp4",
      contentType: "video/mp4",
      fileSize: 9,
    });
    expect(uploadFileToSignedUrl).toHaveBeenCalledWith(
      "https://r2.example/upload",
      expect.any(File),
      "video/mp4",
      progressSpy
    );
    expect(processUploadedMeeting).toHaveBeenCalledWith({
      clientName: "Acme",
      meetingDate: "2026-04-16",
      whatsappNumber: "5511999999999",
      r2Key: "meetings/user-1/123/recording.mp4",
      uploadToken: "signed-upload-token",
    });
    expect(meetingId).toBe("meeting-1");
  });
});
