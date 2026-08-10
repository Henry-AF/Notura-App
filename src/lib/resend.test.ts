import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  isResendConfigured,
  ResendRequestError,
  ResendTimeoutError,
  sendResendEvent,
} from "./resend";

const originalApiKey = process.env.RESEND_API_KEY;
const fetchMock: ReturnType<typeof vi.fn> = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  process.env.RESEND_API_KEY = "re_test_key";
  global.fetch = fetchMock as unknown as typeof fetch;
});

afterEach(() => {
  process.env.RESEND_API_KEY = originalApiKey;
});

describe("isResendConfigured", () => {
  it("returns true when RESEND_API_KEY is set", () => {
    process.env.RESEND_API_KEY = "re_test_key";
    expect(isResendConfigured()).toBe(true);
  });

  it("returns false when RESEND_API_KEY is missing", () => {
    delete process.env.RESEND_API_KEY;
    expect(isResendConfigured()).toBe(false);
  });

  it("returns false when RESEND_API_KEY is blank", () => {
    process.env.RESEND_API_KEY = "   ";
    expect(isResendConfigured()).toBe(false);
  });
});

describe("sendResendEvent success", () => {
  it("resolves on a 202 Accepted response with the correct request shape", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ object: "event", event: "notura.trial_started" }), {
        status: 202,
      })
    );

    await sendResendEvent({
      event: "notura.trial_started",
      email: "ana@example.com",
      payload: { user_id: "user-1", trial_start_at: "2026-08-06T00:00:00.000Z" },
    });

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.resend.com/events/send");
    expect(init.method).toBe("POST");
    expect(init.headers).toEqual({
      "Content-Type": "application/json",
      Authorization: "Bearer re_test_key",
    });
    expect(init.body).toBe(
      JSON.stringify({
        event: "notura.trial_started",
        email: "ana@example.com",
        payload: { user_id: "user-1", trial_start_at: "2026-08-06T00:00:00.000Z" },
      })
    );
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });
});

describe("sendResendEvent failures", () => {
  it("throws ResendRequestError on 401", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ message: "Invalid API key" }), { status: 401 })
    );

    await expect(
      sendResendEvent({
        event: "notura.trial_started",
        email: "ana@example.com",
        payload: {},
      })
    ).rejects.toThrow(ResendRequestError);
  });

  it("throws ResendRequestError on 422", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ message: "Unprocessable" }), { status: 422 })
    );

    await expect(
      sendResendEvent({
        event: "notura.trial_converted",
        email: "ana@example.com",
        payload: {},
      })
    ).rejects.toThrow(ResendRequestError);
  });

  it("throws ResendRequestError on 500", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ message: "Internal error" }), { status: 500 })
    );

    await expect(
      sendResendEvent({
        event: "notura.trial_converted",
        email: "ana@example.com",
        payload: {},
      })
    ).rejects.toThrow(ResendRequestError);
  });

  it("throws ResendTimeoutError when the request aborts", async () => {
    fetchMock.mockImplementationOnce(() =>
      Promise.reject(new DOMException("Aborted", "AbortError"))
    );

    await expect(
      sendResendEvent({
        event: "notura.trial_started",
        email: "ana@example.com",
        payload: {},
      })
    ).rejects.toThrow(ResendTimeoutError);
  });

  it("throws when RESEND_API_KEY is missing", async () => {
    delete process.env.RESEND_API_KEY;

    await expect(
      sendResendEvent({
        event: "notura.trial_started",
        email: "ana@example.com",
        payload: {},
      })
    ).rejects.toThrow("Missing RESEND_API_KEY");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
