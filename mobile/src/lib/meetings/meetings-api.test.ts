import { fetchApi } from "@/lib/api/client";
import { fetchMeetings } from "./meetings-api";

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

function buildApiMeeting(index: number) {
  return {
    id: `meeting-${index}`,
    title: `Meeting ${index}`,
    clientName: `Client ${index}`,
    groupId: index === 0 ? "group-1" : null,
    groupName: index === 0 ? "Project A" : null,
    createdAt: `2026-04-${10 + index}T10:00:00.000Z`,
    status: "completed",
  };
}

describe("fetchMeetings", () => {
  it("fetches the first page without parameters when options are empty", async () => {
    mockedFetchApi.mockResolvedValueOnce(
      mockResponse({
        meetings: [buildApiMeeting(0)],
        nextCursor: null,
        hasMore: false,
      })
    );

    const result = await fetchMeetings();

    expect(mockedFetchApi).toHaveBeenCalledWith("/api/meetings");
    expect(result.meetings).toHaveLength(1);
    expect(result.meetings[0].status).toBe("completed");
    expect(result.nextCursor).toBeNull();
    expect(result.hasMore).toBe(false);
  });

  it("builds query string with pagination and group filter", async () => {
    mockedFetchApi.mockResolvedValueOnce(
      mockResponse({
        meetings: [buildApiMeeting(0)],
        nextCursor: "cursor-1",
        hasMore: true,
      })
    );

    const result = await fetchMeetings({
      limit: 10,
      cursor: "cursor-0",
      groupId: "group-1",
    });

    expect(mockedFetchApi).toHaveBeenCalledWith(
      "/api/meetings?limit=10&cursor=cursor-0&groupId=group-1"
    );
    expect(result.hasMore).toBe(true);
    expect(result.nextCursor).toBe("cursor-1");
  });

  it("throws with the API error message on failure", async () => {
    mockedFetchApi.mockResolvedValueOnce(
      mockResponse({ error: "Erro ao carregar reuniões." }, { ok: false, status: 500 })
    );

    await expect(fetchMeetings()).rejects.toThrow("Erro ao carregar reuniões.");
  });
});
