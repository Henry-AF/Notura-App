import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";

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
