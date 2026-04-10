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

function createServerClient(user: { id: string; email: string } | null) {
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user },
        error: null,
      }),
    },
  };
}

function createDashboardSupabaseClient() {
  const profileMaybeSingle = vi.fn().mockResolvedValue({
    data: { name: "Ana" },
    error: null,
  });
  const profileEq = vi.fn().mockReturnValue({ maybeSingle: profileMaybeSingle });
  const profileSelect = vi.fn().mockReturnValue({ eq: profileEq });

  const recentMeetingsLimit = vi.fn().mockResolvedValue({
    data: [
      {
        id: "meeting-1",
        title: "Kickoff",
        client_name: "Acme",
        status: "completed",
        created_at: "2026-04-10T12:00:00.000Z",
      },
    ],
    error: null,
  });
  const recentMeetingsOrder = vi.fn().mockReturnValue({ limit: recentMeetingsLimit });
  const recentMeetingsEq = vi.fn().mockReturnValue({ order: recentMeetingsOrder });
  const recentMeetingsSelect = vi.fn().mockReturnValue({ eq: recentMeetingsEq });

  const openTaskCountEqSecond = vi.fn().mockResolvedValue({
    count: 1,
    error: null,
  });
  const openTaskCountEqFirst = vi.fn().mockReturnValue({ eq: openTaskCountEqSecond });
  const openTaskCountSelect = vi.fn().mockReturnValue({ eq: openTaskCountEqFirst });

  const openTasksLimit = vi.fn().mockResolvedValue({
    data: [
      {
        id: "task-1",
        description: "Enviar proposta",
        completed: false,
        created_at: "2026-04-10T13:00:00.000Z",
      },
    ],
    error: null,
  });
  const openTasksOrder = vi.fn().mockReturnValue({ limit: openTasksLimit });
  const openTasksEqSecond = vi.fn().mockReturnValue({ order: openTasksOrder });
  const openTasksEqFirst = vi.fn().mockReturnValue({ eq: openTasksEqSecond });
  const openTasksSelect = vi.fn().mockReturnValue({ eq: openTasksEqFirst });

  const todayMeetingsEqSecond = vi.fn().mockResolvedValue({
    count: 1,
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
    data: 7200,
    error: null,
  });

  return { client: { from, rpc }, rpc };
}

describe("dashboard overview", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("loads completed duration with rpc aggregation instead of scanning all meetings", async () => {
    createServerSupabase.mockReturnValue(
      createServerClient({ id: "user-1", email: "ana@example.com" })
    );
    const { client, rpc } = createDashboardSupabaseClient();
    createServiceRoleClient.mockReturnValue(client);
    getBillingStatus.mockResolvedValue({
      billingAccount: { plan: "free" },
      meetingsThisMonth: 2,
      monthlyLimit: 3,
    });

    const mod = await import("./overview");
    const result = await mod.getDashboardOverview();

    expect(rpc).toHaveBeenCalledWith("get_total_completed_meeting_seconds", {
      p_user_id: "user-1",
    });
    expect(result.hoursSaved).toBe(1);
  });
});
