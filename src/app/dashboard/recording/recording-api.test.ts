import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

const fetchMeetingUploadDefaults = vi.fn();
const initMeetingUpload = vi.fn();
const processUploadedMeeting = vi.fn();
const uploadFileToSignedUrl = vi.fn();

vi.mock("@/lib/meetings/meeting-upload-client", () => ({
  fetchMeetingUploadDefaults,
  initMeetingUpload,
  processUploadedMeeting,
}));

vi.mock("@/lib/meetings/upload-client", () => ({
  uploadFileToSignedUrl,
}));

function readSource(path: string): string {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("recording page api client", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("depends on the shared upload client for defaults and upload processing", () => {
    const source = readSource("src/app/dashboard/recording/recording-api.ts");

    expect(source).toContain('@/lib/meetings/meeting-upload-client');
  });

  it("loads recording defaults from the shared meeting intake client", async () => {
    fetchMeetingUploadDefaults.mockResolvedValue({
      accountWhatsappNumber: "5511999999999",
      meetingGroups: [{ id: "group-1", name: "Acme" }],
    });

    const mod = await import("./recording-api");
    const result = await mod.fetchRecordingDefaults();

    expect(result).toEqual({
      accountWhatsappNumber: "5511999999999",
      meetingGroups: [{ id: "group-1", name: "Acme" }],
    });
    expect(fetchMeetingUploadDefaults).toHaveBeenCalledTimes(1);
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
      groupId: "group-1",
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
      groupId: "group-1",
    });
    expect(meetingId).toBe("meeting-1");
  });

  it("deduplicates concurrent recording submissions", async () => {
    initMeetingUpload.mockResolvedValue({
      r2Key: "meetings/user-1/123/recording.mp4",
      uploadUrl: "https://r2.example/upload",
      uploadToken: "signed-upload-token",
    });

    let resolveUpload!: () => void;
    uploadFileToSignedUrl.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveUpload = resolve;
        })
    );
    processUploadedMeeting.mockResolvedValue("meeting-1");

    const mod = await import("./recording-api");
    const payload = {
      clientName: "Acme",
      whatsappNumber: "5511999999999",
      recording: new Blob(["recording"], { type: "video/mp4" }),
      recordedAt: new Date(2026, 3, 16, 14, 30, 0),
    };

    const firstSubmission = mod.submitRecordedMeeting(payload);
    const secondSubmission = mod.submitRecordedMeeting(payload);

    expect(initMeetingUpload).toHaveBeenCalledTimes(1);
    await vi.waitFor(() => {
      expect(uploadFileToSignedUrl).toHaveBeenCalledTimes(1);
    });

    resolveUpload();

    const [firstMeetingId, secondMeetingId] = await Promise.all([
      firstSubmission,
      secondSubmission,
    ]);

    expect(firstMeetingId).toBe("meeting-1");
    expect(secondMeetingId).toBe("meeting-1");
    expect(processUploadedMeeting).toHaveBeenCalledTimes(1);
  });
});
