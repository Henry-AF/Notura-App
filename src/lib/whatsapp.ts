import type { MeetingJSON } from "@/types/database";
import {
  getMeetingDetailButtonParameter,
  getMeetingDetailPath,
  getMeetingDetailUrl,
} from "./meetings/meeting-links";
import { normalizeBrazilianPhone } from "./utils";

const WHATSAPP_API_BASE_URL =
  process.env.WHATSAPP_API_BASE_URL || "https://graph.facebook.com";
const WHATSAPP_ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN;
const WHATSAPP_PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;
const WHATSAPP_API_VERSION = process.env.WHATSAPP_API_VERSION || "v25.0";
const WHATSAPP_TEMPLATE_LANGUAGE = "pt_BR";
const WHATSAPP_MEETING_SUMMARY_TEMPLATE_NAME = "meetin_summary";
const WHATSAPP_MEETING_SUMMARY_TEMPLATE_HAS_URL_BUTTON = false;
const OPERATOR_NUMBER = process.env.OPERATOR_WHATSAPP_NUMBER;
const DEFAULT_MEETING_TITLE = "Reunião processada";
const DEFAULT_PARTICIPANTS = "Não informado";
const DEFAULT_DECISIONS = "Nenhuma decisão registrada.";
const DEFAULT_TASKS = "Nenhuma tarefa registrada.";
const DEFAULT_OPEN_ITEMS = "Nenhum item em aberto.";
const MAX_TEMPLATE_TEXT_LENGTH = 1024;
const TEMPLATE_LIST_SEPARATOR = " | ";

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
    components: TemplateComponent[];
  };
}

type WhatsAppPayload = TextPayload | TemplatePayload;
type TemplateTextParameter = {
  type: "text";
  text: string;
  parameter_name?: string;
};

type TemplateBodyComponent = {
  type: "body";
  parameters: TemplateTextParameter[];
};

type TemplateUrlButtonComponent = {
  type: "button";
  sub_type: "url";
  index: "0";
  parameters: [TemplateTextParameter];
};

type TemplateComponent = TemplateBodyComponent | TemplateUrlButtonComponent;

function getPayloadLogContext(payload: WhatsAppPayload) {
  if (payload.type === "template") {
    const bodyComponent = payload.template.components.find(
      (component): component is TemplateBodyComponent => component.type === "body"
    );
    const buttonComponent = payload.template.components.find(
      (component): component is TemplateUrlButtonComponent =>
        component.type === "button" && component.sub_type === "url"
    );

    return {
      payloadType: payload.type,
      templateName: payload.template.name,
      templateLanguage: payload.template.language.code,
      templateParameterCount: bodyComponent?.parameters.length ?? 0,
      templateHasDynamicUrlButton: Boolean(buttonComponent),
      templateButtonSuffix: buttonComponent?.parameters[0]?.text,
    };
  }

  return {
    payloadType: payload.type,
    textLength: payload.text.body.length,
  };
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
    .replace(/\s+/g, " ")
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
  return items.map((item, index) => `${index + 1}. ${item}`).join(TEMPLATE_LIST_SEPARATOR);
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
): TemplateTextParameter[] {
  return [
    {
      type: "text",
      parameter_name: "title",
      text: toTemplateText(
        getMeetingTitle(summary, fallbackTitle),
        DEFAULT_MEETING_TITLE
      ),
    },
    {
      type: "text",
      parameter_name: "participants",
      text: toTemplateText(formatParticipants(summary), DEFAULT_PARTICIPANTS),
    },
    {
      type: "text",
      parameter_name: "decisions",
      text: toTemplateText(formatDecisions(summary), DEFAULT_DECISIONS),
    },
    {
      type: "text",
      parameter_name: "tasks",
      text: toTemplateText(formatTasks(summary), DEFAULT_TASKS),
    },
    {
      type: "text",
      parameter_name: "open_items",
      text: toTemplateText(formatOpenItems(summary), DEFAULT_OPEN_ITEMS),
    },
  ];
}

async function sendWhatsAppPayload(
  to: string,
  payload: WhatsAppPayload
): Promise<SendResult> {
  const url = getMessagesUrl();
  const phone = normalizeBrazilianPhone(to);
  const payloadContext = getPayloadLogContext(payload);

  if (!url || !WHATSAPP_ACCESS_TOKEN) {
    console.error("[whatsapp] Cloud API configuration is missing", {
      hasMessagesUrl: Boolean(url),
      hasAccessToken: Boolean(WHATSAPP_ACCESS_TOKEN),
      to: phone,
      ...payloadContext,
    });

    return {
      success: false,
      error:
        "WhatsApp Cloud API não configurada (WHATSAPP_PHONE_NUMBER_ID ou WHATSAPP_ACCESS_TOKEN ausentes)",
    };
  }

  try {
    console.info("[whatsapp] Sending payload", {
      to: phone,
      ...payloadContext,
    });

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

      console.error("[whatsapp] Meta Cloud API rejected payload", {
        to: phone,
        status: response.status,
        errorMessage,
        ...payloadContext,
      });

      return {
        success: false,
        error: `HTTP ${response.status}: ${errorMessage}`,
      };
    }

    const data = (await response.json()) as MetaSendMessageResponse;
    const messageId = data.messages?.[0]?.id;

    console.info("[whatsapp] Meta Cloud API accepted payload", {
      to: phone,
      messageId,
      ...payloadContext,
    });

    return { success: true, messageId };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);

    console.error("[whatsapp] Request failed before Meta response", {
      to: phone,
      errorMessage: msg,
      ...payloadContext,
    });

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
  meetingId: string,
  fallbackTitle?: string | null
): Promise<SendResult> {
  const parameters = buildMeetingSummaryTemplateParameters(summary, fallbackTitle);
  const components: TemplateComponent[] = [
    {
      type: "body",
      parameters,
    },
  ];

  if (WHATSAPP_MEETING_SUMMARY_TEMPLATE_HAS_URL_BUTTON) {
    const meetingDetailButtonParameter =
      getMeetingDetailButtonParameter(meetingId);
    const meetingDetailPath = getMeetingDetailPath(meetingId);
    const meetingDetailUrl = getMeetingDetailUrl(meetingId);

    console.info("[whatsapp] Prepared meeting detail button", {
      meetingId,
      meetingDetailButtonParameter,
      meetingDetailPath,
      meetingDetailUrl,
    });

    components.push({
      type: "button",
      sub_type: "url",
      index: "0",
      parameters: [{ type: "text", text: meetingDetailButtonParameter }],
    });
  }

  return sendWhatsAppPayload(to, {
    type: "template",
    template: {
      name: WHATSAPP_MEETING_SUMMARY_TEMPLATE_NAME,
      language: { code: WHATSAPP_TEMPLATE_LANGUAGE },
      components,
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
