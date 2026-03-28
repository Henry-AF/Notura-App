"use server";

import { createServerSupabase } from "@/lib/supabase/server";
import { normalizeBrazilianPhone } from "@/lib/utils";

interface SaveOnboardingProfileInput {
  whatsappNumber: string;
}

interface SaveOnboardingProfileResult {
  success: boolean;
  error?: string;
}

export async function saveOnboardingProfile(
  input: SaveOnboardingProfileInput
): Promise<SaveOnboardingProfileResult> {
  const supabase = createServerSupabase();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return {
      success: false,
      error: "Sessão inválida. Faça login novamente.",
    };
  }

  const rawPhone = input.whatsappNumber.trim();
  if (!rawPhone) {
    return {
      success: false,
      error: "Informe um número de WhatsApp válido.",
    };
  }

  const normalizedPhone = normalizeBrazilianPhone(rawPhone);

  const { error } = await supabase
    .from("profiles")
    .update({ whatsapp_number: normalizedPhone })
    .eq("id", user.id);

  if (error) {
    return {
      success: false,
      error: `Não foi possível salvar seu número: ${error.message}`,
    };
  }

  return { success: true };
}
