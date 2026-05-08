import { describe, expect, it } from "vitest";

describe("auth redirect helpers", () => {
  it("builds a Supabase OAuth callback URL with a relative next path", async () => {
    const { buildOAuthCallbackUrl } = await import("./auth-redirect");

    expect(buildOAuthCallbackUrl("https://app.notura.test", "/onboarding")).toBe(
      "https://app.notura.test/auth/callback?next=%2Fonboarding"
    );
  });

  it("normalizes unsafe next paths back to the dashboard", async () => {
    const { buildOAuthCallbackUrl } = await import("./auth-redirect");

    expect(
      buildOAuthCallbackUrl("https://app.notura.test", "https://evil.example")
    ).toBe("https://app.notura.test/auth/callback?next=%2Fdashboard");
  });
});
