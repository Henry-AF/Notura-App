import { beforeEach, describe, expect, it, vi } from "vitest";

const generateContentMock = vi.fn();
const getGenerativeModelMock = vi.fn();
const GoogleGenerativeAIMock = vi.fn();

vi.mock("@google/generative-ai", () => {
  GoogleGenerativeAIMock.mockImplementation(() => ({
    getGenerativeModel: getGenerativeModelMock,
  }));

  getGenerativeModelMock.mockImplementation(() => ({
    generateContent: generateContentMock,
  }));

  return {
    GoogleGenerativeAI: GoogleGenerativeAIMock,
  };
});

function createValidGeminiResponse() {
  return {
    response: {
      text: () =>
        JSON.stringify({
          summary_whatsapp: "Resumo pronto para WhatsApp",
          summary_json: {
            version: "1.0",
            meeting: {
              title: "Reuniao",
              date_mentioned: null,
              duration_minutes: null,
              participants: [],
              participant_count: 0,
            },
            decisions: [],
            tasks: [],
            open_items: [],
            next_meeting: {
              datetime: null,
              location_or_link: null,
            },
            summary_one_line: "Resumo em uma linha",
            metadata: {
              prompt_version: "1.1.0",
              total_decisions: 0,
              total_tasks: 0,
              total_open_items: 0,
            },
          },
        }),
    },
  };
}

describe("generateMeetingSummary retry policy", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    process.env.GEMINI_API_KEY = "test-gemini-key";
  });

  it("does not retry non-retryable provider errors like 404", async () => {
    generateContentMock.mockRejectedValue(
      new Error(
        "[GoogleGenerativeAI Error]: Error fetching from https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent: [404 Not Found] model not found"
      )
    );

    const mod = await import("./gemini");
    await expect(mod.generateMeetingSummary("transcript")).rejects.toThrow(
      /404 Not Found/i
    );
    expect(generateContentMock).toHaveBeenCalledTimes(1);
  });

  it("retries once on retryable provider errors like 429", async () => {
    generateContentMock
      .mockRejectedValueOnce(
        new Error(
          "[GoogleGenerativeAI Error]: Error fetching from https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent: [429 Too Many Requests] quota exceeded"
        )
      )
      .mockResolvedValueOnce(createValidGeminiResponse());

    const mod = await import("./gemini");
    const result = await mod.generateMeetingSummary("transcript");

    expect(result.summaryWhatsapp).toBe("Resumo pronto para WhatsApp");
    expect(generateContentMock).toHaveBeenCalledTimes(2);
  });
});
