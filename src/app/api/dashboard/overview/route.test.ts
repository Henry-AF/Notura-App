import type { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const createServerSupabase = vi.fn();
const createServiceRoleClient = vi.fn();
const getBillingStatus = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createServerSupabase,
  createServiceRoleClient,
}));

vi.mock("@/lib/billing", () => ({
  getBillingStatus,
}));

function createMobileAuthClient() {
  const getUser = vi.fn(async (token?: string) => ({
    data: {
      user:
        token === "mobile-token"
          ? { id: "mobile-user", email: "mobile@example.com" }
          : null,
    },
    error: token === "mobile-token" ? null : { message: "Missing session" },
  }));

  return {
    auth: {
      getUser,
    },
  };
}

function createDashboardSupabaseClient() {
  const profileMaybeSingle = vi.fn().mockResolvedValue({
    data: { name: "Mobile Ana" },
    error: null,
  });
  const profileEq = vi.fn().mockReturnValue({ maybeSingle: profileMaybeSingle });
  const profileSelect = vi.fn().mockReturnValue({ eq: profileEq });

  const recentMeetingsLimit = vi.fn().mockResolvedValue({
    data: [],
    error: null,
  });
  const recentMeetingsOrder = vi.fn().mockReturnValue({ limit: recentMeetingsLimit });
  const recentMeetingsEq = vi.fn().mockReturnValue({ order: recentMeetingsOrder });
  const recentMeetingsSelect = vi.fn().mockReturnValue({ eq: recentMeetingsEq });

  const openTaskCountEqSecond = vi.fn().mockResolvedValue({
    count: 0,
    error: null,
  });
  const openTaskCountEqFirst = vi.fn().mockReturnValue({ eq: openTaskCountEqSecond });
  const openTaskCountSelect = vi.fn().mockReturnValue({ eq: openTaskCountEqFirst });

  const openTasksLimit = vi.fn().mockResolvedValue({
    data: [],
    error: null,
  });
  const openTasksOrder = vi.fn().mockReturnValue({ limit: openTasksLimit });
  const openTasksEqSecond = vi.fn().mockReturnValue({ order: openTasksOrder });
  const openTasksEqFirst = vi.fn().mockReturnValue({ eq: openTasksEqSecond });
  const openTasksSelect = vi.fn().mockReturnValue({ eq: openTasksEqFirst });

  const todayMeetingsEqSecond = vi.fn().mockResolvedValue({
    count: 0,
    error: null,
  });
  const todayMeetingsGte = vi.fn().mockReturnValue({ eq: todayMeetingsEqSecond });
  const todayMeetingsEqFirst = vi.fn().mockReturnValue({ gte: todayMeetingsGte });
  const todayMeetingsSelect = vi.fn().mockReturnValue({ eq: todayMeetingsEqFirst });

  const from = vi.fn((table: string) => {
    if (table === "profiles") return { select: profileSelect };
    if (table === "meetings") {
      const meetingCall = from.mock.calls.filter(([name]) => name === "meetings").length;
      if (meetingCall === 1) return { select: recentMeetingsSelect };
      return { select: todayMeetingsSelect };
    }
    if (table === "tasks") {
      const taskCall = from.mock.calls.filter(([name]) => name === "tasks").length;
      if (taskCall === 1) return { select: openTaskCountSelect };
      return { select: openTasksSelect };
    }
    throw new Error(`Unexpected table: ${table}`);
  });

  const rpc = vi.fn().mockResolvedValue({
    data: 0,
    error: null,
  });

  return { from, rpc };
}

describe("GET /api/dashboard/overview", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("uses the already validated Bearer user for mobile requests", async () => {
    const authClient = createMobileAuthClient();
    createServerSupabase.mockReturnValue(authClient);
    createServiceRoleClient.mockReturnValue(createDashboardSupabaseClient());
    getBillingStatus.mockResolvedValue({
      billingAccount: { plan: "pro" },
      meetingsThisMonth: 4,
      monthlyLimit: 30,
      entitlement: {
        plan: "pro",
        effectivePlan: "pro",
        status: "active",
        isPaidActive: true,
        isExpired: false,
        isInGrace: false,
      },
    });

    const mod = await import("./route");
    const response = await mod.GET(
      new Request("http://localhost/api/dashboard/overview", {
        headers: {
          Authorization: "Bearer mobile-token",
        },
      }) as NextRequest,
      { params: {} } as never
    );

    expect(response.status).toBe(200);
    expect(authClient.auth.getUser).toHaveBeenCalledTimes(1);
    expect(authClient.auth.getUser).toHaveBeenCalledWith("mobile-token");
    expect(await response.json()).toMatchObject({
      userName: "Mobile Ana",
      plan: "pro",
      meetingsThisMonth: 4,
      monthlyLimit: 30,
    });
  });
});
