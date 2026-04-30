import { beforeEach, describe, expect, it, vi } from "vitest";

const embedContentMock = vi.fn();
const generateContentMock = vi.fn();
const getGenerativeModelMock = vi.fn();
const GoogleGenerativeAIMock = vi.fn();

vi.mock("@google/generative-ai", () => {
  GoogleGenerativeAIMock.mockImplementation(() => ({
    getGenerativeModel: getGenerativeModelMock,
  }));

  getGenerativeModelMock.mockImplementation(() => ({
    embedContent: embedContentMock,
    generateContent: generateContentMock,
  }));

  return {
    GoogleGenerativeAI: GoogleGenerativeAIMock,
    TaskType: {
      RETRIEVAL_DOCUMENT: "RETRIEVAL_DOCUMENT",
      RETRIEVAL_QUERY: "RETRIEVAL_QUERY",
    },
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

function createEmbeddingResponse() {
  return {
    embedding: {
      values: Array.from({ length: 768 }, () => 0.25),
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

describe("generateMeetingSummary dynamic summary length", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    process.env.GEMINI_API_KEY = "test-gemini-key";
    generateContentMock.mockResolvedValue(createValidGeminiResponse());
  });

  it("uses the default WhatsApp summary word limit when duration is unknown", async () => {
    const mod = await import("./gemini");
    await mod.generateMeetingSummary("transcript");

    expect(generateContentMock).toHaveBeenCalledWith(
      expect.stringContaining('Limite de tamanho do "summary_whatsapp": até 400 palavras.')
    );
    expect(generateContentMock).toHaveBeenCalledWith(
      expect.stringContaining("Duração da reunião: não informada.")
    );
  });

  it.each([
    [30 * 60, 150],
    [60 * 60, 300],
    [90 * 60, 500],
    [108 * 60, 700],
  ])(
    "uses a %i second duration to set a %i word WhatsApp summary limit",
    async (durationSeconds, expectedWordLimit) => {
      const mod = await import("./gemini");
      await mod.generateMeetingSummary("transcript", durationSeconds);

      expect(generateContentMock).toHaveBeenCalledWith(
        expect.stringContaining(
          `Limite de tamanho do "summary_whatsapp": até ${expectedWordLimit} palavras.`
        )
      );
    }
  );
});

describe("generateMeetingSummary summary parity", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    process.env.GEMINI_API_KEY = "test-gemini-key";
    generateContentMock.mockResolvedValue(createValidGeminiResponse());
  });

  it("instructs Gemini to keep summary_whatsapp and summary_json factually equivalent", async () => {
    const mod = await import("./gemini");
    await mod.generateMeetingSummary("transcript", 6480);

    expect(getGenerativeModelMock).toHaveBeenCalledWith(
      expect.objectContaining({
        systemInstruction: expect.stringContaining(
          "devem conter as mesmas informações factuais"
        ),
      })
    );
  });
});

describe("generateEmbedding", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    process.env.GEMINI_API_KEY = "test-gemini-key";
    embedContentMock.mockResolvedValue(createEmbeddingResponse());
  });

  it("requests a 768-dimensional Gemini embedding using MRL", async () => {
    const mod = await import("./gemini");
    const embedding = await mod.generateEmbedding("Texto para busca");

    expect(getGenerativeModelMock).toHaveBeenCalledWith({
      model: "gemini-embedding-001",
    });
    expect(embedContentMock).toHaveBeenCalledWith({
      content: {
        role: "user",
        parts: [{ text: "Texto para busca" }],
      },
      taskType: "RETRIEVAL_DOCUMENT",
      outputDimensionality: 768,
    });
    expect(embedding).toHaveLength(768);
  });
});
