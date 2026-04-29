import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const ORIGINAL_ENV = { ...process.env };

describe("sendMeetingSummaryTemplate", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
    process.env = {
      ...ORIGINAL_ENV,
      WHATSAPP_PHONE_NUMBER_ID: "123456789",
      WHATSAPP_ACCESS_TOKEN: "test-token",
      WHATSAPP_MEETING_SUMMARY_TEMPLATE_NAME: "meetin_summary",
      WHATSAPP_TEMPLATE_LANGUAGE: "pt_BR",
      NEXT_PUBLIC_APP_URL: "https://app.notura.com",
    };
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  it("sanitizes template placeholders before sending to Meta", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ messages: [{ id: "wamid.test" }] }),
    });

    vi.stubGlobal("fetch", fetchMock);

    const { sendMeetingSummaryTemplate } = await import("./whatsapp");

    await sendMeetingSummaryTemplate(
      "5511999999999",
      {
        meeting: {
          title: "Reunião\nfinal",
          participants: ["Ana\tMaria", "João    Silva"],
        },
        decisions: [
          { description: "Definir\nescopo" },
          { description: "Aprovar     orçamento" },
        ],
        tasks: [{ description: "Enviar\tfollow-up" }],
        open_items: [{ description: "Prazo\ncomercial" }],
      } as Parameters<typeof sendMeetingSummaryTemplate>[1],
      "meeting-123",
      "Fallback"
    );

    const requestBody = JSON.parse(fetchMock.mock.calls[0][1]?.body as string) as {
      template: {
        components: Array<{
          type: string;
          parameters: Array<{ type: string; text: string }>;
        }>;
      };
    };

    const bodyComponent = requestBody.template.components.find(
      (component) => component.type === "body"
    );
    const buttonComponent = requestBody.template.components.find(
      (component) => component.type === "button"
    );

    expect(bodyComponent).toBeDefined();
    expect(buttonComponent).toBeUndefined();

    for (const parameter of bodyComponent?.parameters ?? []) {
      expect(parameter.text).not.toMatch(/[\n\r\t]/);
      expect(parameter.text).not.toMatch(/ {5,}/);
    }

    expect(bodyComponent?.parameters).toHaveLength(5);
    expect(bodyComponent?.parameters.map((parameter) => parameter.parameter_name)).toEqual([
      "title",
      "participants",
      "decisions",
      "tasks",
      "open_items",
    ]);
    expect(bodyComponent?.parameters[0]?.text).toBe("Reunião final");
    expect(bodyComponent?.parameters[1]?.text).toBe("Ana Maria, João Silva");
    expect(bodyComponent?.parameters[2]?.text).toBe(
      "1. Definir escopo | 2. Aprovar orçamento"
    );
  });

  it("includes the dynamic url button only when the template config enables it", async () => {
    process.env.WHATSAPP_MEETING_SUMMARY_TEMPLATE_HAS_URL_BUTTON = "true";

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ messages: [{ id: "wamid.test" }] }),
    });

    vi.stubGlobal("fetch", fetchMock);

    const { sendMeetingSummaryTemplate } = await import("./whatsapp");

    await sendMeetingSummaryTemplate(
      "5511999999999",
      null,
      "meeting-123",
      "Fallback"
    );

    const requestBody = JSON.parse(fetchMock.mock.calls[0][1]?.body as string) as {
      template: {
        components: Array<{
          type: string;
          sub_type?: string;
          index?: string;
          parameters: Array<{ type: string; text: string }>;
        }>;
      };
    };

    const buttonComponent = requestBody.template.components.find(
      (component) => component.type === "button"
    );

    expect(buttonComponent).toBeDefined();
    expect(buttonComponent).toMatchObject({
      type: "button",
      sub_type: "url",
      index: "0",
      parameters: [{ type: "text", text: "meeting-123" }],
    });
  });
});
