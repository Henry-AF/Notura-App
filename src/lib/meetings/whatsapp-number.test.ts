import { describe, expect, it } from "vitest";
import {
  formatWhatsappNumberForDisplay,
  getWhatsappNumberValidationError,
  isValidWhatsappNumber,
  maskBrazilianPhoneInput,
  normalizeWhatsappNumber,
} from "./whatsapp-number";

describe("whatsapp-number", () => {
  it("normalizes local numbers into 55-prefixed format", () => {
    expect(normalizeWhatsappNumber("(11) 99999-0000")).toBe("5511999990000");
  });

  it("accepts already normalized numbers", () => {
    expect(isValidWhatsappNumber("5511999990000")).toBe(true);
  });

  it("returns validation error for invalid numbers", () => {
    expect(getWhatsappNumberValidationError("11999")).toBe(
      "Informe um número brasileiro válido com DDD."
    );
  });

  it("applies brazilian mask for input display", () => {
    expect(maskBrazilianPhoneInput("5511987654321")).toBe("(11) 98765-4321");
  });

  it("formats normalized numbers for readonly display", () => {
    expect(formatWhatsappNumberForDisplay("5511987654321")).toBe(
      "(11) 98765-4321"
    );
  });
});
