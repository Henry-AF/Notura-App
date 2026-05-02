import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  captureObservedError: vi.fn(),
  createFunction: vi.fn(),
  createServiceRoleClient: vi.fn(),
  inngestSend: vi.fn(),
  logStructured: vi.fn(),
}));

vi.mock("@/lib/inngest", () => ({
  inngest: {
    createFunction: mocks.createFunction,
    send: mocks.inngestSend,
  },
}));

vi.mock("@/lib/supabase/server", () => ({
  createServiceRoleClient: mocks.createServiceRoleClient,
}));

vi.mock("@/lib/observability", () => ({
  captureObservedError: mocks.captureObservedError,
  createTraceId: () => "trace-id",
  getErrorMessage: (error: unknown) =>
    error instanceof Error ? error.message : String(error),
  logStructured: mocks.logStructured,
}));

interface OutboxRow {
  id: string;
  chat_id: string;
  meeting_id: string;
  user_id: string;
  event_name: string;
  payload: Record<string, string>;
  status: "pending" | "processing" | "sent" | "dead";
  attempts: number;
}

function createOutboxRow(overrides: Partial<OutboxRow> = {}): OutboxRow {
  return {
    id: "outbox-1",
    chat_id: "chat-1",
    meeting_id: "meeting-1",
    user_id: "user-1",
    event_name: "meeting/chat.answer",
    payload: {
      chatId: "chat-1",
      meetingId: "meeting-1",
      userId: "user-1",
    },
    status: "pending",
    attempts: 0,
    ...overrides,
  };
}

function createSupabaseMock(rows: OutboxRow[]) {
  const rpc = vi.fn().mockResolvedValue({ data: true, error: null });
  const updates: unknown[] = [];
  const chatUpdates: unknown[] = [];
  const selectLimit = vi.fn().mockResolvedValue({ data: rows, error: null });
  const claimMaybeSingle = vi.fn().mockImplementation(() => {
    const nextAttempts = rows[0].attempts + 1;
    return Promise.resolve({
      data: { ...rows[0], status: "processing", attempts: nextAttempts },
      error: null,
    });
  });
  const finalEq = vi.fn().mockResolvedValue({ error: null });
  const chatUpdateQuery = {
    eq: vi.fn(),
  };
  chatUpdateQuery.eq.mockReturnValue(chatUpdateQuery);
  const update = vi.fn((payload: unknown) => {
    updates.push(payload);
    return {
      eq: vi.fn(() => ({
        in: vi.fn(() => ({
          lte: vi.fn(() => ({
            select: vi.fn(() => ({ maybeSingle: claimMaybeSingle })),
          })),
        })),
      })),
    };
  });

  const from = vi.fn((table: string) => ({
    select: vi.fn(() => ({
      in: vi.fn(() => ({
        lte: vi.fn(() => ({
          order: vi.fn(() => ({ limit: selectLimit })),
        })),
      })),
    })),
    update: vi.fn((payload: unknown) => {
      if (table === "meeting_chats") {
        chatUpdates.push(payload);
        return chatUpdateQuery;
      }

      if (
        payload &&
        typeof payload === "object" &&
        "status" in payload &&
        payload.status === "processing"
      ) {
        return update(payload);
      }

      updates.push(payload);
      return { eq: finalEq };
    }),
  }));

  return { from, rpc, updates, chatUpdates, chatUpdateQuery };
}

async function runDispatcher() {
  const { dispatchMeetingChatOutbox } = await import("./meeting-chat-outbox");
  const step = {
    run: vi.fn(async (_name: string, fn: () => unknown) => await fn()),
  };

  return (dispatchMeetingChatOutbox as { handler: (input: unknown) => Promise<unknown> })
    .handler({
      event: {
        id: "event-1",
        name: "meeting/chat.outbox.dispatch",
        data: {},
      },
      step,
    });
}

describe("dispatchMeetingChatOutbox", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    mocks.createFunction.mockImplementation((_config, handler) => ({ handler }));
    mocks.inngestSend.mockResolvedValue(undefined);
  });

  it("sends pending outbox events and marks them as sent", async () => {
    const supabase = createSupabaseMock([createOutboxRow()]);
    mocks.createServiceRoleClient.mockReturnValue(supabase);

    await runDispatcher();

    expect(mocks.inngestSend).toHaveBeenCalledWith({
      name: "meeting/chat.answer",
      data: {
        chatId: "chat-1",
        meetingId: "meeting-1",
        userId: "user-1",
      },
    });
    expect(supabase.updates).toContainEqual(
      expect.objectContaining({ status: "sent", last_error: null })
    );
  });

  it("requeues failed sends while attempts are not above three", async () => {
    const supabase = createSupabaseMock([createOutboxRow({ attempts: 2 })]);
    mocks.createServiceRoleClient.mockReturnValue(supabase);
    mocks.inngestSend.mockRejectedValue(new Error("Inngest unavailable"));

    await runDispatcher();

    expect(supabase.updates).toContainEqual(
      expect.objectContaining({
        status: "pending",
        last_error: "Inngest unavailable",
      })
    );
    expect(mocks.captureObservedError).not.toHaveBeenCalled();
  });

  it("marks failed sends as dead when attempts are above three and alerts observability", async () => {
    const supabase = createSupabaseMock([createOutboxRow({ attempts: 3 })]);
    mocks.createServiceRoleClient.mockReturnValue(supabase);
    mocks.inngestSend.mockRejectedValue(new Error("Inngest unavailable"));

    await runDispatcher();

    expect(supabase.updates).toContainEqual(
      expect.objectContaining({
        status: "dead",
        last_error: "Inngest unavailable",
      })
    );
    expect(mocks.captureObservedError).toHaveBeenCalled();
  });

  it("marks the related processing chat as failed when the outbox becomes dead", async () => {
    const supabase = createSupabaseMock([createOutboxRow({ attempts: 3 })]);
    mocks.createServiceRoleClient.mockReturnValue(supabase);
    mocks.inngestSend.mockRejectedValue(new Error("Inngest unavailable"));

    await runDispatcher();

    expect(supabase.chatUpdates).toContainEqual(
      expect.objectContaining({
        status: "failed",
        fallback_reason: "provider_error",
        model_confirmed: false,
        error_message: "Inngest unavailable",
        sources: [],
      })
    );
    expect(supabase.chatUpdateQuery.eq).toHaveBeenCalledWith("id", "chat-1");
    expect(supabase.chatUpdateQuery.eq).toHaveBeenCalledWith("status", "processing");
    expect(supabase.rpc).toHaveBeenCalledWith("refund_meeting_chat_ai_usage", {
      p_user_id: "user-1",
      p_chat_id: "chat-1",
      p_ai_feature: "meeting_chat",
      p_reason: "provider_error",
    });
  });
});
