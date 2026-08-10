import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  captureObservedError: vi.fn(),
  logStructured: vi.fn(),
  createServiceRoleClient: vi.fn(),
}));

vi.mock("@/lib/observability", () => ({
  captureObservedError: mocks.captureObservedError,
  createTraceId: () => "trace-id",
  logStructured: mocks.logStructured,
}));

vi.mock("@/lib/supabase/server", () => ({
  createServiceRoleClient: mocks.createServiceRoleClient,
}));

function createAuthClient(getUserById: ReturnType<typeof vi.fn>) {
  return { auth: { admin: { getUserById } } };
}

describe("getUserEmailById", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns the user's email when found", async () => {
    const getUserById = vi.fn().mockResolvedValue({
      data: { user: { email: "ana@example.com" } },
      error: null,
    });
    const { getUserEmailById } = await import("./user-email");

    const email = await getUserEmailById(
      "user-1",
      createAuthClient(getUserById) as never
    );

    expect(email).toBe("ana@example.com");
    expect(getUserById).toHaveBeenCalledWith("user-1");
  });

  it("returns null and captures the error when the lookup fails", async () => {
    const getUserById = vi.fn().mockResolvedValue({
      data: { user: null },
      error: new Error("not found"),
    });
    const { getUserEmailById } = await import("./user-email");

    const email = await getUserEmailById(
      "user-1",
      createAuthClient(getUserById) as never
    );

    expect(email).toBeNull();
    expect(mocks.captureObservedError).toHaveBeenCalled();
  });

  it("returns null when the user has no email", async () => {
    const getUserById = vi.fn().mockResolvedValue({
      data: { user: { email: null } },
      error: null,
    });
    const { getUserEmailById } = await import("./user-email");

    const email = await getUserEmailById(
      "user-1",
      createAuthClient(getUserById) as never
    );

    expect(email).toBeNull();
    expect(mocks.captureObservedError).not.toHaveBeenCalled();
  });
});
