import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const createTemporaryToken = vi.fn();

vi.mock("assemblyai", () => ({
  AssemblyAI: vi.fn(() => ({
    streaming: {
      createTemporaryToken,
    },
  })),
}));

describe("createStreamingToken", () => {
  const originalApiKey = process.env.ASSEMBLYAI_API_KEY;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.ASSEMBLYAI_API_KEY = "aai-test-key";
  });

  afterEach(() => {
    process.env.ASSEMBLYAI_API_KEY = originalApiKey;
  });

  it("requests a v3 streaming token capped at 600 seconds", async () => {
    createTemporaryToken.mockResolvedValue("temp-token-abc");
    const { createStreamingToken } = await import("./assemblyai");

    const token = await createStreamingToken();

    expect(token).toBe("temp-token-abc");
    expect(createTemporaryToken).toHaveBeenCalledWith({ expires_in_seconds: 600 });
  });

  it("throws when ASSEMBLYAI_API_KEY is not configured", async () => {
    delete process.env.ASSEMBLYAI_API_KEY;
    const { createStreamingToken } = await import("./assemblyai");

    await expect(createStreamingToken()).rejects.toThrow(
      "ASSEMBLYAI_API_KEY não configurado no servidor."
    );
  });
});
