import { beforeEach, describe, expect, it, vi } from "vitest";

const authContext = {
  user: {
    id: "user-1",
    email: "ana@example.com",
  },
} as never;
const createStreamingToken = vi.fn();

vi.mock("@/lib/api/rate-limit-route", () => ({
  withAuthRateLimit: (_policy: unknown, handler: (...args: unknown[]) => Promise<Response>) => {
    return (request: Request, context: { params: Record<string, string> }) =>
      handler(request, { ...context, auth: authContext });
  },
}));

vi.mock("@/lib/assemblyai", () => ({
  createStreamingToken,
}));

describe("POST /api/assemblyai/token", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("returns the streaming token from the AssemblyAI lib helper", async () => {
    createStreamingToken.mockResolvedValue("temp-token-123");
    const mod = await import("./route");

    const response = await mod.POST(
      new Request("http://localhost/api/assemblyai/token", { method: "POST" }) as never,
      { params: {} }
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ token: "temp-token-123" });
  });

  it("returns a 502 when the AssemblyAI lib helper fails", async () => {
    createStreamingToken.mockRejectedValue(new Error("ASSEMBLYAI_API_KEY não configurado no servidor."));
    const mod = await import("./route");

    const response = await mod.POST(
      new Request("http://localhost/api/assemblyai/token", { method: "POST" }) as never,
      { params: {} }
    );

    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({
      error: "Falha ao gerar token de transcrição.",
    });
  });
});
