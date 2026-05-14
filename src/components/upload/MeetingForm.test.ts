import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function readSource(path: string): string {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("MeetingForm", () => {
  it("can hide the WhatsApp recipient controls for non-paying users", () => {
    const source = readSource("src/components/upload/MeetingForm.tsx");

    expect(source).toContain("canSendWhatsAppSummary");
    expect(source).toContain("Número WhatsApp para resumo");
    expect(source).toContain("whatsappNumber: canSendWhatsAppSummary");
  });
});
