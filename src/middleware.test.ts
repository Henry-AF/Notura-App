import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const originalSupabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const originalSupabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

afterEach(() => {
  if (typeof originalSupabaseUrl === "undefined") {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  } else {
    process.env.NEXT_PUBLIC_SUPABASE_URL = originalSupabaseUrl;
  }

  if (typeof originalSupabaseAnonKey === "undefined") {
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  } else {
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = originalSupabaseAnonKey;
  }

  vi.restoreAllMocks();
});

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

describe("middleware Supabase fallback", () => {
  it("returns NextResponse.next for dashboard routes when Supabase envs are missing", async () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const { middleware } = await import("./middleware");

    const request = new NextRequest("http://localhost:3000/dashboard");

    const response = await middleware(request);

    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("[supabase] middleware: Missing environment variables NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY."),
    );
  });
});
