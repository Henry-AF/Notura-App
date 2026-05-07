import { beforeEach, expect, it, vi } from "vitest";

const createServiceRoleClient = vi.fn();
const inngestSend = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createServiceRoleClient,
}));

vi.mock("@/lib/inngest", () => ({
  inngest: {
    send: inngestSend,
  },
}));

function createRenewalClient(existingAccount: Record<string, unknown>) {
  const updateQuery = { eq: vi.fn() };
  updateQuery.eq
    .mockReturnValueOnce(updateQuery)
    .mockResolvedValueOnce({ error: null });

  const update = vi.fn().mockReturnValue(updateQuery);
  const maybeSingle = vi.fn().mockResolvedValue({
    data: existingAccount,
    error: null,
  });
  const selectEq = vi.fn().mockReturnValue({ maybeSingle });
  const select = vi.fn().mockReturnValue({ eq: selectEq });
  const from = vi.fn().mockReturnValue({ select, update });

  return { from, selectEq, update, updateQuery };
}

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  inngestSend.mockResolvedValue(undefined);
});

it("extends delayed customer renewals from the previous period end", async () => {
  const client = createRenewalClient({
    user_id: "user-1",
    plan: "pro",
    current_period_end: "2026-05-27T12:00:00.000Z",
  });
  createServiceRoleClient.mockReturnValue(client);

  const mod = await import("./billing");
  await mod.resetSubscriptionPeriod({
    abacatepayCustomerId: "customer-1",
    now: new Date("2026-05-30T12:00:00.000Z"),
  });

  expect(client.update).toHaveBeenCalledWith(
    expect.objectContaining({
      meetings_used: 0,
      current_period_start: "2026-05-27T12:00:00.000Z",
      current_period_end: "2026-06-27T12:00:00.000Z",
      abacatepay_customer_id: "customer-1",
      abacatepay_renewal_status: "active",
      updated_at: "2026-05-30T12:00:00.000Z",
    })
  );
  expect(client.updateQuery.eq).toHaveBeenNthCalledWith(
    1,
    "abacatepay_customer_id",
    "customer-1"
  );
  expect(client.updateQuery.eq).toHaveBeenNthCalledWith(
    2,
    "current_period_end",
    "2026-05-27T12:00:00.000Z"
  );
  expect(inngestSend).toHaveBeenCalledWith({
    id: "renew:user-1:2026-06-27T12:00:00.000Z",
    name: "billing/abacatepay.renew",
    data: { userId: "user-1", attempt: 1 },
    ts: new Date("2026-06-27T12:00:00.000Z").getTime(),
  });
});

it("guards explicit renewal anchors against webhook replay", async () => {
  const client = createRenewalClient({});
  createServiceRoleClient.mockReturnValue(client);

  const mod = await import("./billing");
  await mod.resetSubscriptionPeriod({
    userId: "user-1",
    plan: "team",
    now: new Date("2026-05-30T12:00:00.000Z"),
    previousPeriodEnd: "2026-05-27T12:00:00.000Z",
  });

  expect(client.update).toHaveBeenCalledWith(
    expect.objectContaining({
      current_period_start: "2026-05-27T12:00:00.000Z",
      current_period_end: "2026-06-27T12:00:00.000Z",
    })
  );
  expect(client.updateQuery.eq).toHaveBeenNthCalledWith(1, "user_id", "user-1");
  expect(client.updateQuery.eq).toHaveBeenNthCalledWith(
    2,
    "current_period_end",
    "2026-05-27T12:00:00.000Z"
  );
});

it("skips replayed customer renewals after the account is already active", async () => {
  const client = createRenewalClient({
    plan: "pro",
    current_period_end: "2026-06-27T12:00:00.000Z",
  });
  createServiceRoleClient.mockReturnValue(client);

  const mod = await import("./billing");
  await mod.resetSubscriptionPeriod({
    abacatepayCustomerId: "customer-1",
    now: new Date("2026-05-30T12:00:00.000Z"),
  });

  expect(client.update).not.toHaveBeenCalled();
});
