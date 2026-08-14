// ─────────────────────────────────────────────────────────────────────────────
// Resend integration — dispatches lifecycle events to Resend's Events API.
// Docs: POST https://api.resend.com/events/send
// ─────────────────────────────────────────────────────────────────────────────

const RESEND_API_BASE_URL = (
  process.env.RESEND_API_BASE_URL || "https://api.resend.com"
).trim();
const RESEND_EVENTS_SEND_PATH = "/events/send";
export const RESEND_REQUEST_TIMEOUT_MS = 5000;

export type NoturaResendEventName =
  | "notura.trial_started"
  | "notura.trial_converted"
  | "notura.reengagement_48h";

export interface SendResendEventInput {
  event: NoturaResendEventName;
  email: string;
  payload: Record<string, string>;
}

export class ResendRequestError extends Error {
  constructor(operation: string, public readonly status: number, message: string) {
    super(`Resend request failed during ${operation} (HTTP ${status}): ${message}`);
    this.name = "ResendRequestError";
  }
}

export class ResendTimeoutError extends Error {
  constructor(operation: string, timeoutMs = RESEND_REQUEST_TIMEOUT_MS) {
    super(`Resend timed out during ${operation} after ${timeoutMs}ms`);
    this.name = "ResendTimeoutError";
  }
}

export function isResendConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY?.trim());
}

function getResendApiKey(): string {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("Missing RESEND_API_KEY");
  }
  return apiKey;
}

async function parseResendErrorMessage(response: Response): Promise<string> {
  try {
    const data = (await response.json()) as { message?: string };
    return typeof data.message === "string" ? data.message : `HTTP ${response.status}`;
  } catch {
    return `HTTP ${response.status}`;
  }
}

export async function sendResendEvent(input: SendResendEventInput): Promise<void> {
  const operation = `events/send:${input.event}`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), RESEND_REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(
      `${RESEND_API_BASE_URL.replace(/\/+$/, "")}${RESEND_EVENTS_SEND_PATH}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getResendApiKey()}`,
        },
        body: JSON.stringify({
          event: input.event,
          email: input.email,
          payload: input.payload,
        }),
        signal: controller.signal,
      }
    );

    if (!response.ok) {
      const message = await parseResendErrorMessage(response);
      throw new ResendRequestError(operation, response.status, message);
    }
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new ResendTimeoutError(operation);
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}
