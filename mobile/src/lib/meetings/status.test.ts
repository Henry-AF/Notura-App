import { fetchApi } from "@/lib/api/client";
import {
  cancelMeetingProcessing,
  fetchMeetingStatus,
  retryMeetingProcessing,
} from "./status";

jest.mock("@/lib/api/client", () => ({
  fetchApi: jest.fn(),
}));

const mockedFetchApi = fetchApi as jest.Mock;

function mockResponse(body: unknown, init: { ok?: boolean; status?: number } = {}): Response {
  return {
    ok: init.ok ?? true,
    status: init.status ?? 200,
    json: async () => body,
  } as unknown as Response;
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe("fetchMeetingStatus", () => {
  it("maps the /api/meetings/[id]/status payload", async () => {
    mockedFetchApi.mockResolvedValueOnce(
      mockResponse({
        id: "meeting-1",
        title: "Reunião de Sprint",
        status: "processing",
        processingStep: "transcribe",
        jobStatus: "running",
        errorMessage: null,
        taskCount: 2,
        decisionCount: 1,
      })
    );

    const result = await fetchMeetingStatus("meeting-1");

    expect(mockedFetchApi).toHaveBeenCalledWith("/api/meetings/meeting-1/status");
    expect(result).toEqual({
      id: "meeting-1",
      title: "Reunião de Sprint",
      status: "processing",
      processingStep: "transcribe",
      jobStatus: "running",
      errorMessage: null,
      taskCount: 2,
      decisionCount: 1,
    });
  });

  it("normalizes an unknown status to processing", async () => {
    mockedFetchApi.mockResolvedValueOnce(
      mockResponse({ id: "meeting-1", status: "queued" })
    );

    const result = await fetchMeetingStatus("meeting-1");
    expect(result.status).toBe("processing");
  });

  it("throws the API error message on failure", async () => {
    mockedFetchApi.mockResolvedValueOnce(
      mockResponse({ error: "Reunião não encontrada." }, { ok: false, status: 404 })
    );

    await expect(fetchMeetingStatus("missing-id")).rejects.toThrow("Reunião não encontrada.");
  });
});

describe("retryMeetingProcessing", () => {
  it("resolves when the API reports success", async () => {
    mockedFetchApi.mockResolvedValueOnce(mockResponse({ success: true }));

    await retryMeetingProcessing("meeting-1");

    expect(mockedFetchApi).toHaveBeenCalledWith("/api/meetings/meeting-1/retry", {
      method: "POST",
    });
  });

  it("throws when the API fails", async () => {
    mockedFetchApi.mockResolvedValueOnce(
      mockResponse({ error: "Não permitido" }, { ok: false, status: 409 })
    );

    await expect(retryMeetingProcessing("meeting-1")).rejects.toThrow("Não permitido");
  });
});

describe("cancelMeetingProcessing", () => {
  it("resolves when the API reports success", async () => {
    mockedFetchApi.mockResolvedValueOnce(mockResponse({ success: true }));

    await cancelMeetingProcessing("meeting-1");

    expect(mockedFetchApi).toHaveBeenCalledWith("/api/meetings/meeting-1/cancel-processing", {
      method: "POST",
    });
  });

  it("throws when the API fails", async () => {
    mockedFetchApi.mockResolvedValueOnce(
      mockResponse({ error: "Não em processamento" }, { ok: false, status: 409 })
    );

    await expect(cancelMeetingProcessing("meeting-1")).rejects.toThrow("Não em processamento");
  });
});
