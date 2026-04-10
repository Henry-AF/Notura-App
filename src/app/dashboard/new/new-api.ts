import { normalizeError, parseJson } from "@/lib/api-client";
import {
  isValidWhatsappNumber,
  normalizeWhatsappNumber,
} from "@/lib/meetings/whatsapp-number";

interface NewPageUserResponse {
  user?: {
    whatsappNumber?: string;
  };
  error?: string;
}

export interface NewMeetingDefaults {
  accountWhatsappNumber: string;
}

export async function fetchNewMeetingDefaults(): Promise<NewMeetingDefaults> {
  const response = await fetch("/api/user/me", { method: "GET" });
  const body = await parseJson<NewPageUserResponse>(response);

  if (!response.ok || !body.user) {
    throw new Error(normalizeError(body.error, "Erro ao carregar usuário."));
  }

  const normalized = normalizeWhatsappNumber(body.user.whatsappNumber ?? "");
  return {
    accountWhatsappNumber: isValidWhatsappNumber(normalized) ? normalized : "",
  };
}
