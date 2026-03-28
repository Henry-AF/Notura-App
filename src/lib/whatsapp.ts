// ─────────────────────────────────────────────────────────────────────────────
// Notura — WhatsApp integration via Meta WhatsApp Cloud API
// ─────────────────────────────────────────────────────────────────────────────

import { normalizeBrazilianPhone } from "./utils";

const WHATSAPP_API_BASE_URL =
  process.env.WHATSAPP_API_BASE_URL || "https://graph.facebook.com";
const WHATSAPP_ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN;
const WHATSAPP_PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;
const WHATSAPP_API_VERSION = process.env.WHATSAPP_API_VERSION || "v25.0";
const OPERATOR_NUMBER = process.env.OPERATOR_WHATSAPP_NUMBER;

interface SendResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

interface MetaSendMessageResponse {
  messages?: Array<{ id?: string }>;
}

function getMessagesUrl(): string | null {
  if (!WHATSAPP_PHONE_NUMBER_ID) return null;
  return `${WHATSAPP_API_BASE_URL.replace(/\/+$/, "")}/${WHATSAPP_API_VERSION}/${WHATSAPP_PHONE_NUMBER_ID}/messages`;
}

async function getErrorMessage(response: Response): Promise<string> {
  try {
    const data = (await response.json()) as {
      error?: {
        message?: string;
        error_user_msg?: string;
        error_data?: { details?: string };
      };
    };

    return (
      data?.error?.error_user_msg ||
      data?.error?.error_data?.details ||
      data?.error?.message ||
      `HTTP ${response.status}`
    );
  } catch {
    const errorBody = await response.text();
    return errorBody || `HTTP ${response.status}`;
  }
}

export async function sendWhatsAppMessage(
  to: string,
  message: string
): Promise<SendResult> {
  const url = getMessagesUrl();

  if (!url || !WHATSAPP_ACCESS_TOKEN) {
    return {
      success: false,
      error:
        "WhatsApp Cloud API não configurada (WHATSAPP_PHONE_NUMBER_ID ou WHATSAPP_ACCESS_TOKEN ausentes)",
    };
  }

  const phone = normalizeBrazilianPhone(to);

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${WHATSAPP_ACCESS_TOKEN}`,
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: phone,
        type: "text",
        text: {
          body: message,
          preview_url: false,
        },
      }),
    });

    if (!response.ok) {
      const errorMessage = await getErrorMessage(response);
      return {
        success: false,
        error: `HTTP ${response.status}: ${errorMessage}`,
      };
    }

    const data = (await response.json()) as MetaSendMessageResponse;
    return { success: true, messageId: data?.messages?.[0]?.id };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return { success: false, error: msg };
  }
}

export async function sendTypingIndicator(
  to: string,
  durationMs: number = 2000
): Promise<void> {
  void to;
  void durationMs;
  // Meta's official Cloud API only supports typing indicators when replying
  // to a specific inbound message ID, so there is no direct equivalent here.
}

export async function isNumberValid(number: string): Promise<boolean> {
  if (!WHATSAPP_ACCESS_TOKEN || !WHATSAPP_PHONE_NUMBER_ID) return false;
  const phone = normalizeBrazilianPhone(number);
  // Cloud API accepts phone numbers directly for sends, but it does not expose
  // a simple "number exists on WhatsApp" lookup equivalent to Evolution.
  return /^55\d{10,11}$/.test(phone);
}

export async function alertOperator(message: string): Promise<void> {
  if (!OPERATOR_NUMBER) return;
  await sendWhatsAppMessage(OPERATOR_NUMBER, `⚠️ Notura Alerta:\n${message}`);
}
