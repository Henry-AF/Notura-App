import { describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const getUserMock = vi.fn();
const signOutMock = vi.fn();

vi.mock("@supabase/ssr", () => ({
  createServerClient: vi.fn(() => ({
    auth: {
      getUser: getUserMock,
      signOut: signOutMock,
    },
  })),
}));

describe("middleware CORS (API)", () => {
  it("returns 204 for OPTIONS from allowed origin", async () => {
    const { middleware } = await import("./middleware");

    const request = new NextRequest("http://localhost:3000/api/meetings", {
      method: "OPTIONS",
      headers: {
        origin: "http://localhost:11000",
        "access-control-request-headers": "authorization,content-type",
      },
    });

    const response = await middleware(request);

    expect(response.status).toBe(204);
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("http://localhost:11000");
    expect(response.headers.get("Access-Control-Allow-Headers")).toBe("authorization,content-type");
  });

  it("returns 403 for OPTIONS from blocked origin", async () => {
    const { middleware } = await import("./middleware");

    const request = new NextRequest("http://localhost:3000/api/meetings", {
      method: "OPTIONS",
      headers: {
        origin: "https://evil.example",
      },
    });

    const response = await middleware(request);

    expect(response.status).toBe(403);
  });

  it("adds CORS headers on non-OPTIONS requests from allowed origin", async () => {
    const { middleware } = await import("./middleware");

    const request = new NextRequest("http://localhost:3000/api/meetings", {
      method: "GET",
      headers: {
        origin: "http://localhost:11000",
      },
    });

    const response = await middleware(request);

    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("http://localhost:11000");
    expect(response.headers.get("Access-Control-Allow-Credentials")).toBe("true");
  });
});

describe("middleware auth", () => {
  it("does not delete Supabase cookies when the auth check times out", async () => {
    getUserMock.mockRejectedValueOnce(new TypeError("fetch failed"));
    const { middleware } = await import("./middleware");

    const request = new NextRequest("http://localhost:3000/dashboard", {
      headers: {
        cookie: "sb-test-auth-token=abc",
      },
    });

    const response = await middleware(request);

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "http://localhost:3000/login?redirectTo=%2Fdashboard"
    );
    expect(response.headers.get("set-cookie") ?? "").not.toContain(
      "sb-test-auth-token=;"
    );
  });
});

describe("middleware login redirect", () => {
  it("redirects an authenticated user away from /login to /dashboard", async () => {
    getUserMock.mockResolvedValueOnce({ data: { user: { id: "user-1" } }, error: null });
    const { middleware } = await import("./middleware");

    const request = new NextRequest("http://localhost:3000/login", {
      headers: {
        cookie: "sb-test-auth-token=abc",
      },
    });

    const response = await middleware(request);

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("http://localhost:3000/dashboard");
  });

  it("renders /login normally when there is no session", async () => {
    getUserMock.mockResolvedValueOnce({ data: { user: null }, error: null });
    const { middleware } = await import("./middleware");

    const request = new NextRequest("http://localhost:3000/login");

    const response = await middleware(request);

    expect(response.status).not.toBe(307);
    expect(response.headers.get("location")).toBeNull();
  });

  it("redirects to a valid redirectTo destination", async () => {
    getUserMock.mockResolvedValueOnce({ data: { user: { id: "user-1" } }, error: null });
    const { middleware } = await import("./middleware");

    const request = new NextRequest(
      "http://localhost:3000/login?redirectTo=%2Fdashboard%2Fsettings"
    );

    const response = await middleware(request);

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "http://localhost:3000/dashboard/settings"
    );
  });

  it("falls back to /dashboard when redirectTo is an external URL", async () => {
    getUserMock.mockResolvedValueOnce({ data: { user: { id: "user-1" } }, error: null });
    const { middleware } = await import("./middleware");

    const request = new NextRequest(
      "http://localhost:3000/login?redirectTo=https%3A%2F%2Fevil.example"
    );

    const response = await middleware(request);

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("http://localhost:3000/dashboard");
  });

  it("treats a stale refresh token on /login as unauthenticated (no redirect to dashboard)", async () => {
    getUserMock.mockResolvedValueOnce({
      data: { user: null },
      error: { code: "refresh_token_not_found" },
    });
    const { middleware } = await import("./middleware");

    const request = new NextRequest("http://localhost:3000/login", {
      headers: {
        cookie: "sb-test-auth-token=abc",
      },
    });

    const response = await middleware(request);

    expect(response.status).not.toBe(307);
    expect(response.headers.get("location")).toBeNull();
  });
});
