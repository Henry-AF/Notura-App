import { beforeEach, describe, expect, it, vi } from "vitest";

const exchangeCodeForSession = vi.fn();
const createServerSupabase = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createServerSupabase,
}));

describe("auth callback route", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    createServerSupabase.mockReturnValue({
      auth: { exchangeCodeForSession },
    });
  });

  it("exchanges the OAuth code for a server session before redirecting to onboarding", async () => {
    exchangeCodeForSession.mockResolvedValue({ error: null });

    const { GET } = await import("./route");

    const response = await GET(
      new Request("http://localhost/auth/callback?code=oauth-code&next=/onboarding")
    );

    expect(exchangeCodeForSession).toHaveBeenCalledWith("oauth-code");
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("http://localhost/onboarding");
  });

  it("falls back to login when Supabase rejects the OAuth code", async () => {
    exchangeCodeForSession.mockResolvedValue({
      error: { message: "invalid code" },
    });

    const { GET } = await import("./route");

    const response = await GET(
      new Request("http://localhost/auth/callback?code=bad-code&next=/onboarding")
    );

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "http://localhost/login?error=oauth_callback_failed"
    );
  });
});
