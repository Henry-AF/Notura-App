import { fetchApi } from "@/lib/api/client";
import { fetchMeetingGroups } from "./groups-api";

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

describe("fetchMeetingGroups", () => {
  it("maps the /api/meeting-groups snapshot response", async () => {
    mockedFetchApi.mockResolvedValueOnce(
      mockResponse({
        groups: [
          {
            id: "group-1",
            name: "Project A",
            created_at: "2026-04-01T10:00:00.000Z",
            updated_at: "2026-04-02T10:00:00.000Z",
            meetings_count: 5,
          },
        ],
      })
    );

    const result = await fetchMeetingGroups();

    expect(mockedFetchApi).toHaveBeenCalledWith("/api/meeting-groups");
    expect(result).toEqual([
      {
        id: "group-1",
        name: "Project A",
        createdAt: "2026-04-01T10:00:00.000Z",
        updatedAt: "2026-04-02T10:00:00.000Z",
        meetingsCount: 5,
      },
    ]);
  });

  it("returns an empty array when the API omits groups", async () => {
    mockedFetchApi.mockResolvedValueOnce(mockResponse({}));

    const result = await fetchMeetingGroups();

    expect(result).toEqual([]);
  });

  it("throws the API error message on failure", async () => {
    mockedFetchApi.mockResolvedValueOnce(
      mockResponse({ error: "Erro ao carregar grupos." }, { ok: false, status: 500 })
    );

    await expect(fetchMeetingGroups()).rejects.toThrow("Erro ao carregar grupos.");
  });
});
