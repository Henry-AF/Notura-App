export const NOTURA_SUPPORT_WHATSAPP_NUMBER = "5513996495858";
export const NOTURA_SUPPORT_WHATSAPP_BASE_URL = `https://wa.me/${NOTURA_SUPPORT_WHATSAPP_NUMBER}`;

export function buildSupportWhatsAppUrl(message?: string): string {
  if (!message?.trim()) return NOTURA_SUPPORT_WHATSAPP_BASE_URL;
  const url = new URL(NOTURA_SUPPORT_WHATSAPP_BASE_URL);
  url.searchParams.set("text", message.trim());
  return url.toString();
}
