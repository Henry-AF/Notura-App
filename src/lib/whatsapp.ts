// ─────────────────────────────────────────────────────────────────────────────
// Notura — WhatsApp integration via Evolution API
// ─────────────────────────────────────────────────────────────────────────────

import { normalizeBrazilianPhone } from "./utils";

const EVOLUTION_API_URL = process.env.EVOLUTION_API_URL;
const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY;
const EVOLUTION_INSTANCE = process.env.EVOLUTION_INSTANCE_NAME || "notura";
const OPERATOR_NUMBER = process.env.OPERATOR_WHATSAPP_NUMBER;

interface SendResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

export async function sendWhatsAppMessage(
  to: string,
  message: string
): Promise<SendResult> {
  if (!EVOLUTION_API_URL || !EVOLUTION_API_KEY) {
    return {
      success: false,
      error: "Evolution API não configurada (EVOLUTION_API_URL ou EVOLUTION_API_KEY ausentes)",
    };
  }

  const phone = normalizeBrazilianPhone(to);
  const url = `${EVOLUTION_API_URL.replace(/\/+$/, "")}/message/sendText/${EVOLUTION_INSTANCE}`;

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: EVOLUTION_API_KEY,
      },
      body: JSON.stringify({
        number: phone,
        text: message,
        delay: 1200,
        linkPreview: false,
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      return { success: false, error: `HTTP ${response.status}: ${errorBody}` };
    }

    const data = (await response.json()) as { key?: { id?: string } };
    return { success: true, messageId: data?.key?.id };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return { success: false, error: msg };
  }
}

export async function sendTypingIndicator(
  to: string,
  durationMs: number = 2000
): Promise<void> {
  if (!EVOLUTION_API_URL || !EVOLUTION_API_KEY) return;

  const phone = normalizeBrazilianPhone(to);
  const url = `${EVOLUTION_API_URL.replace(/\/+$/, "")}/chat/presence/${EVOLUTION_INSTANCE}`;

  try {
    await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: EVOLUTION_API_KEY,
      },
      body: JSON.stringify({
        number: phone,
        delay: durationMs,
        presence: "composing",
      }),
    });
  } catch {
    // Non-critical — ignore silently
  }
}

export async function isNumberValid(number: string): Promise<boolean> {
  if (!EVOLUTION_API_URL || !EVOLUTION_API_KEY) return false;

  const phone = normalizeBrazilianPhone(number);
  const url = `${EVOLUTION_API_URL.replace(/\/+$/, "")}/chat/whatsappNumbers/${EVOLUTION_INSTANCE}`;

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: EVOLUTION_API_KEY,
      },
      body: JSON.stringify({ numbers: [phone] }),
    });

    if (!response.ok) return false;
    const data = (await response.json()) as Array<{ exists: boolean }>;
    return data?.[0]?.exists ?? false;
  } catch {
    return false;
  }
}

export async function alertOperator(message: string): Promise<void> {
  if (!OPERATOR_NUMBER) return;
  await sendWhatsAppMessage(OPERATOR_NUMBER, `⚠️ Notura Alerta:\n${message}`);
}
