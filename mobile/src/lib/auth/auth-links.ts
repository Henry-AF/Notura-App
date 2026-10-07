import { getEnv } from "@/lib/env";

const { apiBaseUrl } = getEnv();

export const FORGOT_PASSWORD_URL = `${apiBaseUrl}/forgot-password`;

export const LEGAL_LINKS = [
  { label: "Termos de Uso", url: `${apiBaseUrl}/termos` },
  { label: "Privacidade", url: `${apiBaseUrl}/privacidade` },
] as const;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(value: string): boolean {
  return EMAIL_PATTERN.test(value.trim());
}
