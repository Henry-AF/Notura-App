import { describe, expect, it } from "vitest";
import { WHATSAPP_SUPPORT_URL } from "./whatsapp-support";

describe("WhatsApp support", () => {
  it("uses the support contact shared by dashboard entry points", () => {
    expect(WHATSAPP_SUPPORT_URL).toBe("https://wa.me/5513996495858");
  });
});
