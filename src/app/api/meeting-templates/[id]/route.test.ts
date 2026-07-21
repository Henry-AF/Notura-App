import type { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  MeetingTemplateNotFoundError: class MeetingTemplateNotFoundError extends Error {
    readonly status = 404;
    constructor(message = "not found") {
      super(message);
      this.name = "MeetingTemplateNotFoundError";
    }
  },
  requireOwnership: vi.fn(),
  deleteTemplate: vi.fn(),
  withAuthRateLimit: vi.fn((_policy, handler) => {
    return (request: Request, context: { params: { id: string } }) =>
      handler(request, {
        ...context,
        auth: {
          user: { id: "user-1" },
          supabaseAdmin: { from: vi.fn() },
        },
      });
  }),
}));

vi.mock("@/lib/api/auth", () => ({
  requireOwnership: mocks.requireOwnership,
}));

vi.mock("@/lib/api/rate-limit-route", () => ({
  withAuthRateLimit: mocks.withAuthRateLimit,
}));

vi.mock("@/lib/meeting-templates", () => ({
  MeetingTemplateNotFoundError: mocks.MeetingTemplateNotFoundError,
  deleteTemplate: mocks.deleteTemplate,
}));

describe("DELETE /api/meeting-templates/[id]", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    mocks.requireOwnership.mockResolvedValue(undefined);
    mocks.deleteTemplate.mockResolvedValue(undefined);
  });

  it("returns 403 when the template does not belong to the user", async () => {
    mocks.requireOwnership.mockRejectedValueOnce(
      Response.json({ error: "Acesso negado." }, { status: 403 })
    );

    const mod = await import("./route");
    const response = await mod.DELETE(new Request("http://localhost") as NextRequest, {
      params: { id: "template-1" },
    });

    expect(response.status).toBe(403);
    expect(mocks.deleteTemplate).not.toHaveBeenCalled();
  });

  it("deletes the template and returns 204 on success", async () => {
    const mod = await import("./route");
    const response = await mod.DELETE(new Request("http://localhost") as NextRequest, {
      params: { id: "template-1" },
    });

    expect(response.status).toBe(204);
    expect(mocks.deleteTemplate).toHaveBeenCalledWith(
      expect.anything(),
      "user-1",
      "template-1"
    );
  });

  it("returns 404 when the template row disappears before delete completes", async () => {
    mocks.deleteTemplate.mockRejectedValueOnce(
      new mocks.MeetingTemplateNotFoundError("Modelo não encontrado.")
    );

    const mod = await import("./route");
    const response = await mod.DELETE(new Request("http://localhost") as NextRequest, {
      params: { id: "template-1" },
    });

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "Modelo não encontrado." });
  });
});
