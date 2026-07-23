import { fetchApi } from "@/lib/api/client";
import { fetchMeetingDetail, mapMeetingDetail } from "./meeting-detail-api";

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

describe("mapMeetingDetail", () => {
  it("maps a completed meeting with all relations", () => {
    const response = {
      id: "meeting-1",
      client_name: "Acme",
      title: "Sprint Planning",
      meeting_date: "2026-04-10T10:00:00.000Z",
      status: "completed",
      meeting_participants: [
        { id: "p1", display_name: "Alice", original_name: "Alice", role: "participant" },
        { id: "p2", display_name: "Engine A", original_name: "Engine A", role: "entity" },
      ],
      summary_whatsapp: "Resumo da reunião.",
      transcript: "Transcrição completa.",
      tasks: [
        { id: "t1", description: "Tarefa 1", completed: false, owner: "Bob", due_date: "2026-04-12" },
      ],
      decisions: [{ id: "d1", description: "Decisão 1", decided_by: "Alice" }],
      open_items: [{ id: "o1", description: "Pendência 1", context: "Contexto" }],
    };

    const result = mapMeetingDetail(response, "meeting-1");

    expect(result.id).toBe("meeting-1");
    expect(result.clientName).toBe("Acme");
    expect(result.status).toBe("completed");
    expect(result.participants).toHaveLength(1);
    expect(result.entities).toHaveLength(1);
    expect(result.summary).toBe("Resumo da reunião.");
    expect(result.transcript).toBe("Transcrição completa.");
    expect(result.tasks).toHaveLength(1);
    expect(result.decisions).toHaveLength(1);
    expect(result.openItems).toHaveLength(1);
  });

  it("uses title as clientName fallback and returns processing for unknown status", () => {
    const response = {
      id: "meeting-2",
      client_name: null,
      title: "Kickoff",
      created_at: "2026-04-10T10:00:00.000Z",
      status: "queued",
    };

    const result = mapMeetingDetail(response, "meeting-2");

    expect(result.clientName).toBe("Kickoff");
    expect(result.status).toBe("processing");
  });
});

describe("fetchMeetingDetail", () => {
  it("fetches and maps the meeting detail", async () => {
    mockedFetchApi.mockResolvedValueOnce(
      mockResponse({
        id: "meeting-1",
        client_name: "Acme",
        status: "completed",
        summary_whatsapp: "Resumo.",
        tasks: [],
        decisions: [],
        open_items: [],
      })
    );

    const result = await fetchMeetingDetail("meeting-1");

    expect(mockedFetchApi).toHaveBeenCalledWith("/api/meetings/meeting-1");
    expect(result.clientName).toBe("Acme");
    expect(result.status).toBe("completed");
  });

  it("throws the API error message on failure", async () => {
    mockedFetchApi.mockResolvedValueOnce(
      mockResponse({ error: "Não encontrada." }, { ok: false, status: 404 })
    );

    await expect(fetchMeetingDetail("missing-id")).rejects.toThrow("Não encontrada.");
  });
});
