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

beforeEach(() => {
  embedContentMock.mockReset();
  generateContentMock.mockReset();
  getGenerativeModelMock.mockClear();
  GoogleGenerativeAIMock.mockClear();
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

  it("does not retry or fallback on invalid request provider errors like 400", async () => {
    generateContentMock.mockRejectedValue(
      new Error(
        "[GoogleGenerativeAI Error]: Error fetching from https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite-preview:generateContent: [400 Bad Request] invalid request"
      )
    );

    const mod = await import("./gemini");
    await expect(mod.generateMeetingSummary("transcript")).rejects.toThrow(
      /400 Bad Request/i
    );
    expect(generateContentMock).toHaveBeenCalledTimes(1);
  });

  it("falls back to stable Gemini 2.5 Flash-Lite when the preview model is unavailable", async () => {
    generateContentMock
      .mockRejectedValueOnce(
        new Error(
          "[GoogleGenerativeAI Error]: Error fetching from https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite-preview:generateContent: [404 Not Found] model not found"
        )
      )
      .mockResolvedValueOnce(createValidGeminiResponse());

    const mod = await import("./gemini");
    const result = await mod.generateMeetingSummary("transcript");

    expect(result.summaryWhatsapp).toBe("Resumo pronto para WhatsApp");
    expect(getGenerativeModelMock).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ model: "gemini-3.1-flash-lite-preview" })
    );
    expect(getGenerativeModelMock).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ model: "gemini-2.5-flash-lite" })
    );
    expect(generateContentMock).toHaveBeenCalledTimes(2);
  });

  it("falls back immediately on preview 503 without retrying the primary model", async () => {
    generateContentMock
      .mockRejectedValueOnce(
        new Error(
          "[GoogleGenerativeAI Error]: Error fetching from https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite-preview:generateContent: [503 Service Unavailable] overloaded"
        )
      )
      .mockResolvedValueOnce(createValidGeminiResponse());

    const mod = await import("./gemini");
    const result = await mod.generateMeetingSummary("transcript");

    expect(result.summaryWhatsapp).toBe("Resumo pronto para WhatsApp");
    expect(getGenerativeModelMock).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ model: "gemini-3.1-flash-lite-preview" })
    );
    expect(getGenerativeModelMock).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ model: "gemini-2.5-flash-lite" })
    );
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

function createQuestionAnswerResponse(body: Record<string, unknown>) {
  return {
    response: {
      text: () => JSON.stringify(body),
    },
  };
}

describe("answerMeetingQuestionFromChunks", () => {
  beforeEach(() => {
    vi.resetModules();
    process.env.GEMINI_API_KEY = "test-gemini-key";
  });

  it("falls back to stable Gemini 2.5 Flash-Lite when answering with the preview model is unavailable", async () => {
    generateContentMock
      .mockRejectedValueOnce(
        new Error(
          "[GoogleGenerativeAI Error]: Error fetching from https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite-preview:generateContent: [404 Not Found] model not found"
        )
      )
      .mockResolvedValueOnce(
        createQuestionAnswerResponse({
          answer: "O prazo combinado foi sexta-feira.",
          is_answered_from_context: true,
          cited_chunk_ids: ["chunk-1"],
          insufficient_context_reason: null,
        })
      );

    const mod = await import("./gemini");
    const result = await mod.answerMeetingQuestionFromChunks({
      question: "Qual foi o prazo?",
      chunks: [
        {
          chunkId: "chunk-1",
          similarity: 0.82,
          startMs: 12000,
          endMs: 18000,
          speaker: "A",
          text: "O prazo combinado foi sexta-feira.",
        },
      ],
    });

    expect(result.answer).toBe("O prazo combinado foi sexta-feira.");
    expect(getGenerativeModelMock).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ model: "gemini-3.1-flash-lite-preview" })
    );
    expect(getGenerativeModelMock).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ model: "gemini-2.5-flash-lite" })
    );
  });

  it("uses a strict system prompt and returns the parsed grounded answer", async () => {
    generateContentMock.mockResolvedValue(
      createQuestionAnswerResponse({
        answer: "O prazo combinado foi sexta-feira.",
        is_answered_from_context: true,
        cited_chunk_ids: ["chunk-1"],
        insufficient_context_reason: null,
      })
    );

    const mod = await import("./gemini");
    const result = await mod.answerMeetingQuestionFromChunks({
      question: "Qual foi o prazo?",
      chunks: [
        {
          chunkId: "chunk-1",
          similarity: 0.82,
          startMs: 12000,
          endMs: 18000,
          speaker: "A",
          text: "O prazo combinado foi sexta-feira.",
        },
      ],
    });

    expect(getGenerativeModelMock).toHaveBeenCalledWith(
      expect.objectContaining({
        systemInstruction: expect.stringContaining(
          "cited_chunk_ids"
        ),
      })
    );
    expect(generateContentMock).toHaveBeenCalledWith(
      expect.stringContaining('id="chunk-1"')
    );
    expect(result).toEqual({
      answer: "O prazo combinado foi sexta-feira.",
      isAnsweredFromContext: true,
      citedChunkIds: ["chunk-1"],
      insufficientContextReason: null,
      modelName: "gemini-3.1-flash-lite-preview",
    });
  });

  it("rejects confirmed answers without structured cited chunk ids", async () => {
    generateContentMock.mockResolvedValue(
      createQuestionAnswerResponse({
        answer: "O prazo combinado foi sexta-feira.",
        is_answered_from_context: true,
        insufficient_context_reason: null,
      })
    );

    const mod = await import("./gemini");

    await expect(
      mod.answerMeetingQuestionFromChunks({
        question: "Qual foi o prazo?",
        chunks: [
          {
            chunkId: "chunk-1",
            similarity: 0.82,
            startMs: 12000,
            endMs: 18000,
            speaker: "A",
            text: "O prazo combinado foi sexta-feira.",
          },
        ],
      })
    ).rejects.toThrow("Gemini returned an invalid meeting chat answer");
  });

  it("rejects answers without an explicit model confirmation field", async () => {
    generateContentMock.mockResolvedValue(
      createQuestionAnswerResponse({
        answer: "Talvez sexta-feira.",
        cited_chunk_ids: [],
        insufficient_context_reason: null,
      })
    );

    const mod = await import("./gemini");

    await expect(
      mod.answerMeetingQuestionFromChunks({
        question: "Qual foi o prazo?",
        chunks: [
          {
            chunkId: "chunk-1",
            similarity: 0.82,
            startMs: 12000,
            endMs: 18000,
            speaker: "A",
            text: "O prazo combinado foi sexta-feira.",
          },
        ],
      })
    ).rejects.toThrow("Gemini returned an invalid meeting chat answer");
  });
});
