import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createFunction: vi.fn(),
  createServiceRoleClient: vi.fn(),
  getBillingStatus: vi.fn(),
  sendInactivityEmailOnce: vi.fn(),
}));

vi.mock("@/lib/inngest", () => ({
  inngest: {
    createFunction: mocks.createFunction,
  },
}));

vi.mock("@/lib/supabase/server", () => ({
  createServiceRoleClient: mocks.createServiceRoleClient,
}));

vi.mock("@/lib/billing", () => ({
  getBillingStatus: mocks.getBillingStatus,
}));

vi.mock("@/lib/email/delivery", () => ({
  sendInactivityEmailOnce: mocks.sendInactivityEmailOnce,
}));

function createSupabaseUsers(users: Array<Record<string, unknown>>) {
  return {
    auth: {
      admin: {
        listUsers: vi.fn().mockResolvedValue({
          data: {
            users,
          },
          error: null,
        }),
      },
    },
  };
}

async function runJob() {
  const { sendUserInactivityEmails } = await import("./user-inactivity-email");
  const step = {
    run: vi.fn(async (_name: string, fn: () => unknown) => await fn()),
  };

  const result = await (
    sendUserInactivityEmails as {
      handler: (input: unknown) => Promise<unknown>;
    }
  ).handler({
    event: { id: "event-1", name: "email/user-inactivity.scan", data: {} },
    step,
  });

  return { result, step };
}

describe("sendUserInactivityEmails", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-28T12:00:00.000Z"));
    mocks.createFunction.mockImplementation((_config, handler) => ({ handler }));
    mocks.getBillingStatus.mockResolvedValue({
      meetingsUsed: 3,
      quotaStatus: {
        quotaLimit: 3,
      },
    });
    mocks.sendInactivityEmailOnce.mockResolvedValue({ status: "sent" });
  });

  it("emails users whose last sign-in is at least 3 days old with quota context", async () => {
    mocks.createServiceRoleClient.mockReturnValue(
      createSupabaseUsers([
        {
          id: "inactive-user",
          email: "ana@example.com",
          last_sign_in_at: "2026-05-25T11:59:00.000Z",
          created_at: "2026-05-20T12:00:00.000Z",
          user_metadata: { full_name: "Ana" },
        },
        {
          id: "active-user",
          email: "bia@example.com",
          last_sign_in_at: "2026-05-27T12:00:00.000Z",
          created_at: "2026-05-20T12:00:00.000Z",
          user_metadata: { full_name: "Bia" },
        },
      ])
    );

    const { result } = await runJob();

    expect(result).toEqual({ sent: 1, skipped: 1, failed: 0 });
    expect(mocks.sendInactivityEmailOnce).toHaveBeenCalledWith({
      userId: "inactive-user",
      email: "ana@example.com",
      name: "Ana",
      meetingsUsed: 3,
      quotaLimit: 3,
    });
  });
});
