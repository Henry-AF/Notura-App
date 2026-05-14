import type { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const createServerSupabase = vi.fn();
const createServiceRoleClient = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createServerSupabase,
  createServiceRoleClient,
}));

function createServerClient(user: { id: string } | null) {
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user },
        error: null,
      }),
    },
  };
}

function createStatusAdminClient() {
  const maybeSingleOwnership = vi.fn().mockResolvedValue({
    data: { id: "meeting-1", user_id: "user-1" },
    error: null,
  });
  const singleMeeting = vi.fn().mockResolvedValue({
    data: {
      id: "meeting-1",
      title: "Kickoff",
      status: "processing",
    },
    error: null,
  });
  const maybeSingleJob = vi.fn().mockResolvedValue({
    data: {
      status: "processing",
      current_step: "summarize-meeting",
      error_message: null,
    },
    error: null,
  });

  const from = vi.fn((table: string) => ({
    select: vi.fn((columns: string) => {
      if (table === "meetings" && columns === "id, user_id") {
        return { eq: vi.fn(() => ({ maybeSingle: maybeSingleOwnership })) };
      }

      if (table === "meetings") {
        return { eq: vi.fn(() => ({ single: singleMeeting })) };
      }

      if (table === "tasks") {
        return {
          eq: vi.fn().mockResolvedValue({ count: 3, error: null }),
        };
      }

      if (table === "decisions") {
        return {
          eq: vi.fn().mockResolvedValue({ count: 2, error: null }),
        };
      }

      return {
        eq: vi.fn(() => ({
          order: vi.fn(() => ({
            limit: vi.fn(() => ({ maybeSingle: maybeSingleJob })),
          })),
        })),
      };
    }),
  }));

  return { from };
}

describe("GET /api/meetings/[id]/status", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();

    createServerSupabase.mockReturnValue(createServerClient({ id: "user-1" }));
    createServiceRoleClient.mockReturnValue(createStatusAdminClient());
  });

  it("returns the latest processing job step with the meeting status", async () => {
    const mod = await import("./route");
    const response = await mod.GET(
      new Request("http://localhost/api/meetings/meeting-1/status") as NextRequest,
      { params: { id: "meeting-1" } }
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      id: "meeting-1",
      title: "Kickoff",
      status: "processing",
      processingStep: "summarize-meeting",
      jobStatus: "processing",
      errorMessage: null,
      taskCount: 3,
      decisionCount: 2,
    });
  });
});
