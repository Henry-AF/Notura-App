import type { MeetingJSON } from "@/types/database";
import { normalizeBrazilianPhone } from "./utils";

const WHATSAPP_API_BASE_URL =
  process.env.WHATSAPP_API_BASE_URL || "https://graph.facebook.com";
const WHATSAPP_ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN;
const WHATSAPP_PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;
const WHATSAPP_API_VERSION = process.env.WHATSAPP_API_VERSION || "v25.0";
const WHATSAPP_TEMPLATE_LANGUAGE =
  process.env.WHATSAPP_TEMPLATE_LANGUAGE || "pt_BR";
const OPERATOR_NUMBER = process.env.OPERATOR_WHATSAPP_NUMBER;

const MEETING_SUMMARY_TEMPLATE_NAME = "meetin_summary";
const MEETING_SUMMARY_STATUS =
  "O resumo inteligente da sua reunião está pronto!";
const DEFAULT_MEETING_TITLE = "Reunião processada";
const DEFAULT_PARTICIPANTS = "Não informado";
const DEFAULT_DECISIONS = "Nenhuma decisão registrada.";
const DEFAULT_TASKS = "Nenhuma tarefa registrada.";
const DEFAULT_OPEN_ITEMS = "Nenhum item em aberto.";
const MAX_TEMPLATE_TEXT_LENGTH = 1024;

type MeetingSummarySource = Partial<MeetingJSON> | null | undefined;

interface SendResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

interface MetaSendMessageResponse {
  messages?: Array<{ id?: string }>;
}

interface TextPayload {
  type: "text";
  text: {
    body: string;
    preview_url: boolean;
  };
}

interface TemplatePayload {
  type: "template";
  template: {
    name: string;
    language: {
      code: string;
    };
    components: Array<{
      type: "body";
      parameters: Array<{
        type: "text";
        text: string;
      }>;
    }>;
  };
}

type WhatsAppPayload = TextPayload | TemplatePayload;

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
      data.error?.error_user_msg ||
      data.error?.error_data?.details ||
      data.error?.message ||
      `HTTP ${response.status}`
    );
  } catch {
    const errorBody = await response.text();
    return errorBody || `HTTP ${response.status}`;
  }
}

function normalizeTemplateText(value: string): string {
  return value
    .normalize("NFKC")
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function toTemplateText(value: string | null | undefined, fallback: string): string {
  const normalized = normalizeTemplateText(value ?? "");
  const resolved = normalized.length > 0 ? normalized : fallback;

  if (resolved.length <= MAX_TEMPLATE_TEXT_LENGTH) {
    return resolved;
  }

  return `${resolved.slice(0, MAX_TEMPLATE_TEXT_LENGTH - 3).trimEnd()}...`;
}

function formatParticipants(summary: MeetingSummarySource): string {
  const participants = summary?.meeting?.participants ?? [];

  const names = participants
    .map((name) => name.trim())
    .filter((name) => name.length > 0);

  return names.length > 0 ? names.join(", ") : DEFAULT_PARTICIPANTS;
}

function formatList(items: string[], fallback: string): string {
  if (items.length === 0) return fallback;
  return items.map((item, index) => `${index + 1}. ${item}`).join("\n");
}

function formatDecisions(summary: MeetingSummarySource): string {
  const decisions = summary?.decisions ?? [];

  const items = decisions
    .map((decision) => decision.description.trim())
    .filter((description) => description.length > 0);

  return formatList(items, DEFAULT_DECISIONS);
}

function formatTasks(summary: MeetingSummarySource): string {
  const tasks = summary?.tasks ?? [];

  const items = tasks
    .map((task) => task.description.trim())
    .filter((description) => description.length > 0);

  return formatList(items, DEFAULT_TASKS);
}

function formatOpenItems(summary: MeetingSummarySource): string {
  const openItems = summary?.open_items ?? [];

  const items = openItems
    .map((item) => item.description.trim())
    .filter((description) => description.length > 0);

  return formatList(items, DEFAULT_OPEN_ITEMS);
}

function getMeetingTitle(
  summary: MeetingSummarySource,
  fallbackTitle?: string | null
): string {
  return (
    summary?.meeting?.title?.trim() ||
    fallbackTitle?.trim() ||
    DEFAULT_MEETING_TITLE
  );
}

function buildMeetingSummaryTemplateParameters(
  summary: MeetingSummarySource,
  fallbackTitle?: string | null
): string[] {
  return [
    toTemplateText(MEETING_SUMMARY_STATUS, MEETING_SUMMARY_STATUS),
    toTemplateText(getMeetingTitle(summary, fallbackTitle), DEFAULT_MEETING_TITLE),
    toTemplateText(formatParticipants(summary), DEFAULT_PARTICIPANTS),
    toTemplateText(formatDecisions(summary), DEFAULT_DECISIONS),
    toTemplateText(formatTasks(summary), DEFAULT_TASKS),
    toTemplateText(formatOpenItems(summary), DEFAULT_OPEN_ITEMS),
  ];
}

async function sendWhatsAppPayload(
  to: string,
  payload: WhatsAppPayload
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
        ...payload,
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
    return { success: true, messageId: data.messages?.[0]?.id };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return { success: false, error: msg };
  }
}

export async function sendWhatsAppMessage(
  to: string,
  message: string
): Promise<SendResult> {
  return sendWhatsAppPayload(to, {
    type: "text",
    text: {
      body: message,
      preview_url: false,
    },
  });
}

export async function sendMeetingSummaryTemplate(
  to: string,
  summary: MeetingSummarySource,
  fallbackTitle?: string | null
): Promise<SendResult> {
  const parameters = buildMeetingSummaryTemplateParameters(summary, fallbackTitle);

  return sendWhatsAppPayload(to, {
    type: "template",
    template: {
      name: MEETING_SUMMARY_TEMPLATE_NAME,
      language: { code: WHATSAPP_TEMPLATE_LANGUAGE },
      components: [
        {
          type: "body",
          parameters: parameters.map((text) => ({ type: "text", text })),
        },
      ],
    },
  });
}

export function sendTypingIndicator(
  to: string,
  durationMs: number = 2000
): Promise<void> {
  void to;
  void durationMs;
  // Meta's official Cloud API only supports typing indicators when replying
  // to a specific inbound message ID, so there is no direct equivalent here.
  return Promise.resolve();
}

export function isNumberValid(number: string): Promise<boolean> {
  if (!WHATSAPP_ACCESS_TOKEN || !WHATSAPP_PHONE_NUMBER_ID) {
    return Promise.resolve(false);
  }
  const phone = normalizeBrazilianPhone(number);
  // Cloud API accepts phone numbers directly for sends, but it does not expose
  // a simple "number exists on WhatsApp" lookup equivalent to Evolution.
  return Promise.resolve(/^55\d{10,11}$/.test(phone));
}

export async function alertOperator(message: string): Promise<void> {
  if (!OPERATOR_NUMBER) return;
  await sendWhatsAppMessage(OPERATOR_NUMBER, `⚠️ Notura Alerta:\n${message}`);
}
