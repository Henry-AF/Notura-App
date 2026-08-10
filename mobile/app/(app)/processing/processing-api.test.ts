import {
  cancelMeetingProcessing,
  fetchMeetingStatus,
  retryMeetingProcessing,
} from "@/lib/meetings/status";
import {
  cancelProcessing,
  fetchProcessingStatus,
  getMeetingDetailRoute,
  retryProcessing,
} from "./processing-api";

jest.mock("@/lib/meetings/status", () => ({
  cancelMeetingProcessing: jest.fn(),
  fetchMeetingStatus: jest.fn(),
  retryMeetingProcessing: jest.fn(),
}));

describe("processing route API", () => {
  it("loads status through the shared meeting status helper", async () => {
    const payload = { id: "meeting-1", status: "processing" };
    (fetchMeetingStatus as jest.Mock).mockResolvedValueOnce(payload);

    await expect(fetchProcessingStatus("meeting-1")).resolves.toBe(payload);
    expect(fetchMeetingStatus).toHaveBeenCalledWith("meeting-1");
  });

  it("delegates retry and cancellation", async () => {
    await retryProcessing("meeting-1");
    await cancelProcessing("meeting-1");

    expect(retryMeetingProcessing).toHaveBeenCalledWith("meeting-1");
    expect(cancelMeetingProcessing).toHaveBeenCalledWith("meeting-1");
  });

  it("builds the terminal meeting detail route", () => {
    expect(getMeetingDetailRoute("meeting-1")).toBe("/(app)/meetings/meeting-1");
  });
});
