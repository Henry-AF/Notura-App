import { normalizeBrazilianPhone } from "@/lib/utils";

const VALID_WHATSAPP_NUMBER_REGEX = /^55\d{10,11}$/;

function stripToDigits(value: string): string {
  return value.replace(/\D/g, "");
}

function toBrazilianLocalDigits(raw: string): string {
  const normalized = normalizeBrazilianPhone(raw);
  const digits = stripToDigits(normalized);
  const localDigits = digits.startsWith("55") ? digits.slice(2) : digits;
  return localDigits.slice(0, 11);
}

export function normalizeWhatsappNumber(raw: string): string {
  return normalizeBrazilianPhone(raw.trim());
}

export function isValidWhatsappNumber(raw: string): boolean {
  return VALID_WHATSAPP_NUMBER_REGEX.test(normalizeWhatsappNumber(raw));
}

export function getWhatsappNumberValidationError(raw: string): string | null {
  if (!raw.trim()) {
    return "Preencha o número de WhatsApp para receber o resumo.";
  }

  if (!isValidWhatsappNumber(raw)) {
    return "Informe um número brasileiro válido com DDD.";
  }

  return null;
}

export function maskBrazilianPhoneInput(raw: string): string {
  const digits = toBrazilianLocalDigits(raw);

  if (digits.length === 0) return "";
  if (digits.length <= 2) return `(${digits}`;
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

export function formatWhatsappNumberForDisplay(raw: string): string {
  if (!isValidWhatsappNumber(raw)) return "";
  return maskBrazilianPhoneInput(raw);
}
